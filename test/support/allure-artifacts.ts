import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { addAttachment } from '@wdio/allure-reporter'
import ffmpegPath from 'ffmpeg-static'
import { browser } from '@wdio/globals'
import loginPage from '../pageobjects/login.page.js'
import { ALLURE_RESULTS_DIR } from './allure-report.js'

type Rect = { x: number, y: number, width: number, height: number }
type TestInfo = {
    title: string
    parent?: string
    file?: string
}
type Attempt = {
    title: string
    recording: boolean
    login: boolean
    redactionRects: Rect[]
    finished: boolean
}

type ArtifactRuntime = typeof globalThis & { __cartobikeAllureAttempt?: Attempt }
const artifactRuntime = globalThis as ArtifactRuntime

function isLoginTest(test: TestInfo): boolean {
    return /login/i.test(`${test.parent ?? ''} ${test.title}`)
}

async function bestEffort(label: string, action: () => Promise<void>): Promise<void> {
    try {
        await action()
    } catch (error) {
        console.warn(`Unable to attach ${label}; preserving the original test result.`, error)
    }
}

/** Start a fresh screen recording for this individual test attempt. */
export async function startTestRecording(test: TestInfo): Promise<void> {
    if (artifactRuntime.__cartobikeAllureAttempt?.title === test.title && !artifactRuntime.__cartobikeAllureAttempt.finished) return
    const attempt: Attempt = {
        title: test.title,
        recording: false,
        login: isLoginTest(test),
        redactionRects: [],
        finished: false
    }
    artifactRuntime.__cartobikeAllureAttempt = attempt
    try {
        await browser.startRecordingScreen()
        attempt.recording = true
    } catch (error) {
        console.warn('Appium screen recording is unavailable for this test attempt.', error)
    }
}

/** WDIO wraps a beforeEach hook title around the test whose setup is running. */
export function testInfoForHook(test: TestInfo): TestInfo {
    const wrappedTestTitle = test.title.match(/wrappedHook for ["'](.+?)["']$/)?.[1]
    return wrappedTestTitle ? { ...test, title: wrappedTestTitle } : test
}

function loginMaskFilter(rects: Rect[], viewport: { width: number, height: number }): string {
    return rects.map(({ x, y, width, height }) => {
        // Use a small margin so cursor/selection text at the input edge is covered too.
        const padX = Math.max(width * 0.06, 4)
        const padY = Math.max(height * 0.15, 3)
        const left = Math.max(0, x - padX) / viewport.width
        const top = Math.max(0, y - padY) / viewport.height
        const boxWidth = Math.min(viewport.width - Math.max(0, x - padX), width + padX * 2) / viewport.width
        const boxHeight = Math.min(viewport.height - Math.max(0, y - padY), height + padY * 2) / viewport.height
        return `drawbox=x=iw*${left}:y=ih*${top}:w=iw*${boxWidth}:h=ih*${boxHeight}:color=black:t=fill`
    }).join(',')
}

async function redactLoginVideo(video: Buffer, rects: Rect[]): Promise<Buffer> {
    if (!ffmpegPath) throw new Error('The bundled FFmpeg executable is unavailable.')
    if (rects.length !== 2) throw new Error('Login video was not attached because both credential field masks were unavailable.')

    const viewport = await browser.getWindowSize()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cartobike-allure-'))
    const input = path.join(tempDir, 'recording.mp4')
    const output = path.join(tempDir, 'redacted.mp4')
    try {
        await writeFile(input, video)
        const filter = loginMaskFilter(rects, viewport)
        await new Promise<void>((resolve, reject) => {
            const child = spawn(ffmpegPath, [
                '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
                '-vf', `fps=5,scale=540:-2,${filter}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '32',
                '-threads', '2', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', output
            ], { windowsHide: true })
            let stderr = ''
            child.stderr.setEncoding('utf8')
            child.stderr.on('data', (chunk: string) => { stderr += chunk })
            child.once('error', reject)
            child.once('close', (code) => code === 0
                ? resolve()
                : reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-2000)}`)))
        })
        return await readFile(output)
    } finally {
        await rm(tempDir, { recursive: true, force: true })
    }
}

/** Stop and discard recordings from passes, or attach safe artifacts to failures. */
export async function finishTestArtifacts(test: TestInfo, failed: boolean, deferAttachment = false): Promise<void> {
    let attempt = artifactRuntime.__cartobikeAllureAttempt
    if (!attempt && failed) {
        // beforeTest may not run when Mocha aborts in a failing beforeEach.
        // afterHook still has the live app screen and can preserve a screenshot.
        attempt = {
            title: test.title,
            recording: false,
            login: isLoginTest(test),
            redactionRects: [],
            finished: false
        }
        artifactRuntime.__cartobikeAllureAttempt = attempt
    }
    if (!attempt || attempt.finished) return
    attempt.finished = true

    let video: Buffer | undefined
    if (attempt.recording) {
        await bestEffort('recording', async () => {
            const encoded = await browser.stopRecordingScreen()
            if (failed && encoded) video = Buffer.from(encoded, 'base64')
        })
    }
    if (!failed) {
        artifactRuntime.__cartobikeAllureAttempt = undefined
        return
    }

    let screenshot: Buffer | undefined
    await bestEffort('failure screenshot', async () => {
        const inputs = await browser.$$('android=new UiSelector().className("android.widget.EditText")')
        for (const input of inputs) await input.clearValue().catch(() => undefined)
        screenshot = Buffer.from(await browser.takeScreenshot(), 'base64')
    })

    let safeVideo: Buffer | undefined
    if (video) {
        await bestEffort('failure execution video', async () => {
            if (attempt.login && attempt.redactionRects.length !== 2) {
                const rects = await loginPage.credentialFieldRects()
                attempt.redactionRects = rects.map(({ x, y, width, height }) => ({ x, y, width, height }))
            }
            safeVideo = attempt.login ? await redactLoginVideo(video!, attempt.redactionRects) : video!
        })
    }

    if (deferAttachment) {
        await persistDeferredAttachments(test, screenshot, safeVideo)
    } else {
        if (screenshot) await bestEffort('failure screenshot attachment', () => addAttachment('Failure Screenshot', screenshot!, 'image/png'))
        if (safeVideo) await bestEffort('failure execution video attachment', () => addAttachment('Failure Execution Video', safeVideo!, 'video/mp4'))
    }
    artifactRuntime.__cartobikeAllureAttempt = undefined
}

type DeferredArtifactManifest = {
    testName: string
    suiteName?: string
    testFile?: string
    capturedAt: number
    attachments: Array<{ name: string, source: string, type: string }>
}

async function persistDeferredAttachments(test: TestInfo, screenshot?: Buffer, video?: Buffer): Promise<void> {
    const resultsDir = ALLURE_RESULTS_DIR
    await mkdir(resultsDir, { recursive: true })
    const attachments: DeferredArtifactManifest['attachments'] = []
    if (screenshot) {
        const source = `${randomUUID()}-attachment.png`
        await writeFile(path.join(resultsDir, source), screenshot)
        attachments.push({ name: 'Failure Screenshot', source, type: 'image/png' })
    }
    if (video) {
        const source = `${randomUUID()}-attachment.mp4`
        await writeFile(path.join(resultsDir, source), video)
        attachments.push({ name: 'Failure Execution Video', source, type: 'video/mp4' })
    }
    if (attachments.length === 0) return
    const manifest: DeferredArtifactManifest = {
        testName: test.title,
        suiteName: test.parent,
        testFile: test.file,
        capturedAt: Date.now(),
        attachments
    }
    await writeFile(path.join(resultsDir, `${randomUUID()}-deferred-artifacts.json`), JSON.stringify(manifest))
}

/** Attach hook-failure artifacts after WDIO has emitted the affected Allure result. */
export async function attachDeferredArtifacts(): Promise<void> {
    const resultsDir = ALLURE_RESULTS_DIR
    let names: string[]
    try {
        names = await readdir(resultsDir)
    } catch {
        return
    }
    for (const name of names.filter((entry) => entry.endsWith('-deferred-artifacts.json'))) {
        const manifestPath = path.join(resultsDir, name)
        try {
            const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as DeferredArtifactManifest
            const results = await Promise.all(names
                .filter((entry) => entry.endsWith('-result.json'))
                .map(async (entry) => ({ file: entry, result: JSON.parse(await readFile(path.join(resultsDir, entry), 'utf8')) as {
                    name?: string, start?: number, stage?: string, status?: string,
                    labels?: Array<{ name: string, value: string }>, attachments?: Array<{ source?: string }>
                } })))
            const candidates = results.filter(({ result }) => result.name === manifest.testName &&
                result.stage === 'finished' && ['broken', 'failed'].includes(result.status ?? '') &&
                (!manifest.suiteName || result.labels?.some((label) => label.name === 'suite' && label.value === manifest.suiteName)) &&
                (!manifest.testFile || result.labels?.some((label) => label.name === 'package' && label.value.includes(path.basename(manifest.testFile!))))
            )
            candidates.sort((a, b) => Math.abs((a.result.start ?? 0) - manifest.capturedAt) - Math.abs((b.result.start ?? 0) - manifest.capturedAt))
            const target = candidates[0]
            if (!target) {
                console.warn(`No failed Allure result matched setup-hook artifacts for "${manifest.testName}".`)
                continue
            }
            target.result.attachments ??= []
            for (const attachment of manifest.attachments) {
                if (!target.result.attachments.some((existing) => existing.source === attachment.source)) {
                    target.result.attachments.push(attachment)
                }
            }
            await writeFile(path.join(resultsDir, target.file), JSON.stringify(target.result, null, 2))
            await rm(manifestPath, { force: true })
        } catch (error) {
            console.warn(`Unable to attach deferred Allure artifacts from ${name}.`, error)
        }
    }
}
