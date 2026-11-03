import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const ALLURE_RESULTS_DIR = path.resolve('./allure-current-run-results')
const ALLURE_REPORTS_DIR = path.resolve('./allure-current-run-report/Teste Reports')
const REPORT_LAUNCHER = 'Open Report.bat'
const REPORT_LAUNCHER_CONTENT = [
    '@echo off',
    'setlocal',
    'for %%I in ("%~dp0.") do set "REPORT_DIR=%%~fI"',
    'for %%I in ("%~dp0..\\..\\..") do set "PROJECT_ROOT=%%~fI"',
    'call "%PROJECT_ROOT%\\node_modules\\.bin\\allure.cmd" open "%REPORT_DIR%"',
    'endlocal',
    ''
].join('\r\n')

type AllureCommand = (args: string[]) => ChildProcess
const require = createRequire(import.meta.url)
const allureCommand = require('allure-commandline') as AllureCommand

/** Start each run with only its own raw Allure results. */
export async function prepareAllureResults(): Promise<void> {
    await rm(ALLURE_RESULTS_DIR, { recursive: true, force: true })
    await mkdir(ALLURE_RESULTS_DIR, { recursive: true })
}

function reportTimestamp(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

async function pathExists(target: string): Promise<boolean> {
    try {
        await access(target)
        return true
    } catch {
        return false
    }
}

async function nextReportDirectory(): Promise<string> {
    await mkdir(ALLURE_REPORTS_DIR, { recursive: true })
    const baseTime = new Date()
    for (let offsetSeconds = 0; offsetSeconds < 86400; offsetSeconds += 1) {
        const date = new Date(baseTime.getTime() + offsetSeconds * 1000)
        const candidate = path.join(ALLURE_REPORTS_DIR, `Test Report ${reportTimestamp(date)}`)
        if (!(await pathExists(candidate))) return candidate
    }
    throw new Error('Could not choose a unique timestamped Allure report directory.')
}

/** Generate a static report in a fresh timestamped folder and wait for the CLI. */
export async function generateAllureReport(): Promise<string> {
    const resultFiles = await readdir(ALLURE_RESULTS_DIR)
    const hasResults = resultFiles.some((file) => file.endsWith('-result.json'))
    if (!hasResults) throw new Error(`No Allure test results were found in ${ALLURE_RESULTS_DIR}.`)

    const reportDir = await nextReportDirectory()
    await new Promise<void>((resolve, reject) => {
        const child = allureCommand(['generate', ALLURE_RESULTS_DIR, '--output', reportDir])
        child.once('error', reject)
        child.once('close', (code) => code === 0
            ? resolve()
            : reject(new Error(`Allure CLI exited with code ${code}.`)))
    })
    await writeFile(path.join(reportDir, REPORT_LAUNCHER), REPORT_LAUNCHER_CONTENT, 'utf8')
    return reportDir
}
