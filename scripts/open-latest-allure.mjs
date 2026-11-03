import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { access, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const reportsDirectory = path.resolve('allure-current-run-report', 'Teste Reports')
const reportNamePattern = /^Test Report \d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/
const require = createRequire(import.meta.url)
const allureCommand = require('allure-commandline')

export async function findLatestReport(directory = reportsDirectory) {
    let entries
    try {
        entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
        if (error?.code === 'ENOENT') return undefined
        throw error
    }

    const newestName = entries
        .filter((entry) => entry.isDirectory() && reportNamePattern.test(entry.name))
        .map((entry) => entry.name)
        .sort((left, right) => right.localeCompare(left))[0]

    return newestName ? path.join(directory, newestName) : undefined
}

export async function resolveReportReference(reference) {
    if (!reference) return findLatestReport()

    const reportPath = reportNamePattern.test(reference)
        ? path.join(reportsDirectory, reference)
        : path.resolve(reference)
    try {
        if (!(await stat(reportPath)).isDirectory()) throw new Error('the path is not a directory')
        await access(path.join(reportPath, 'index.html'))
        return reportPath
    } catch (error) {
        throw new Error(`No generated Allure report with an index.html was found at "${reportPath}": ${error.message}`)
    }
}

export async function openReport(reference) {
    const reportPath = await resolveReportReference(reference)
    if (!reportPath) {
        console.error(`No timestamped Allure reports were found in ${reportsDirectory}. Run the test suite first.`)
        process.exitCode = 1
        return
    }

    console.info(`Opening Allure report: ${reportPath}`)
    await new Promise((resolve, reject) => {
        const child = allureCommand(['open', reportPath])
        child.once('error', reject)
        child.once('close', (code) => code === 0
            ? resolve()
            : reject(new Error(`Allure CLI exited with code ${code}.`)))
    })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    openReport(process.argv[2]).catch((error) => {
        console.error('Unable to open the Allure report.', error)
        process.exitCode = 1
    })
}
