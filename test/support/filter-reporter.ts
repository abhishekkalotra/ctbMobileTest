import { addAttachment } from '@wdio/allure-reporter'
import { browser } from '@wdio/globals'
import fs from 'node:fs'
import path from 'node:path'

export interface FilterResultRecord {
    filterName: string
    selectedValue: string
    totalResults: number
    matchingResults: number
    status: 'PASS' | 'FAIL' | 'SKIPPED'
    details?: string
    failureReason?: string
    mismatchedListings?: string[]
}

export class FilterValidationReporter {
    private records: FilterResultRecord[] = []
    private identifiedFilters: string[] = [
        'Search',
        'Select a Vehicle',
        'Condition',
        'Brand',
        'Price',
        'Recoverable VAT',
        'Year',
        'KM',
        'Body type',
        'Fuel',
        'Transmission',
        'Country',
        'Color',
        'Upholstery color',
        'Upholstery',
        'Number of seats',
        'Seller Type',
        'Warranty from',
        'Power HP',
        'Emission standard',
        'Only with photo'
    ]

    public getIdentifiedFilters (): string[] {
        return [...this.identifiedFilters]
    }

    private isFilterTested (identified: string): boolean {
        return this.records.some(r => {
            const rec = r.filterName.toLowerCase()
            const ident = identified.toLowerCase()
            return rec.includes(ident) || ident.includes(rec) ||
                (ident === 'select a vehicle' && rec.includes('vehicle category')) ||
                (ident === 'recoverable vat' && rec.includes('vat')) ||
                (ident === 'km' && (rec.includes('kilometer') || rec.includes('mileage')))
        })
    }

    public record (record: FilterResultRecord): void {
        this.records.push(record)
    }

    public async captureFailureScreenshot (filterName: string): Promise<void> {
        try {
            const screenshot = await browser.takeScreenshot()
            addAttachment(
                `Mismatch Screenshot - ${filterName}`,
                Buffer.from(screenshot, 'base64'),
                'image/png'
            )
        } catch (err) {
            console.warn(`Could not capture screenshot for ${filterName}:`, err)
        }
    }

    public generateSummaryMarkdown (): string {
        const totalIdentified = this.identifiedFilters.length
        const totalTested = this.records.length
        const totalPassed = this.records.filter(r => r.status === 'PASS').length
        const totalFailed = this.records.filter(r => r.status === 'FAIL').length
        const skippedFilters = this.identifiedFilters.filter(f => !this.isFilterTested(f))
        const totalSkipped = skippedFilters.length

        let md = `## Filter Validation Execution Summary\n\n`
        md += `| Filter | Selected Value | Total Results | Matching Results | Status |\n`
        md += `| :--- | :--- | :---: | :---: | :---: |\n`
        for (const r of this.records) {
            md += `| ${r.filterName} | ${r.selectedValue} | ${r.totalResults} | ${r.matchingResults} | **${r.status}** |\n`
        }
        md += `\n### Statistics\n`
        md += `- **Total Filters Identified:** ${totalIdentified}\n`
        md += `- **Total Filters Tested:** ${totalTested}\n`
        md += `- **Total Passed:** ${totalPassed}\n`
        md += `- **Total Failed:** ${totalFailed}\n`
        md += `- **Total Skipped:** ${totalSkipped}\n`

        if (skippedFilters.length > 0) {
            md += `\n### Skipped / Untested Filters (${totalSkipped})\n`
            for (const s of skippedFilters) {
                md += `- ${s}\n`
            }
        }

        const failed = this.records.filter(r => r.status === 'FAIL')
        if (failed.length > 0) {
            md += `\n### Failures & Mismatched Listings\n`
            for (const f of failed) {
                md += `#### ${f.filterName} (${f.selectedValue})\n`
                md += `- **Reason:** ${f.failureReason ?? 'Mismatch detected'}\n`
                if (f.mismatchedListings && f.mismatchedListings.length > 0) {
                    md += `- **Mismatched Items:**\n`
                    for (const item of f.mismatchedListings) {
                        md += `  - \`${item}\`\n`
                    }
                }
            }
        }
        return md
    }

    public generateHtmlReport (): string {
        const totalIdentified = this.identifiedFilters.length
        const totalTested = this.records.length
        const totalPassed = this.records.filter(r => r.status === 'PASS').length
        const totalFailed = this.records.filter(r => r.status === 'FAIL').length
        const skippedFilters = this.identifiedFilters.filter(f => !this.isFilterTested(f))
        const totalSkipped = skippedFilters.length

        const rows = this.records.map(r => `
            <tr style="background-color: ${r.status === 'PASS' ? '#e6f4ea' : r.status === 'FAIL' ? '#fce8e6' : '#f1f3f4'};">
                <td style="padding: 10px; border: 1px solid #dadce0; font-weight: bold;">${r.filterName}</td>
                <td style="padding: 10px; border: 1px solid #dadce0;">${r.selectedValue}</td>
                <td style="padding: 10px; border: 1px solid #dadce0; text-align: right;">${r.totalResults}</td>
                <td style="padding: 10px; border: 1px solid #dadce0; text-align: right;">${r.matchingResults}</td>
                <td style="padding: 10px; border: 1px solid #dadce0; font-weight: bold; color: ${r.status === 'PASS' ? '#137333' : '#c5221f'};">${r.status}</td>
            </tr>
        `).join('')

        const skippedRows = skippedFilters.map(s => `
            <tr style="background-color: #f1f3f4; color: #5f6368;">
                <td style="padding: 10px; border: 1px solid #dadce0; font-weight: bold;">${s}</td>
                <td style="padding: 10px; border: 1px solid #dadce0;">-</td>
                <td style="padding: 10px; border: 1px solid #dadce0; text-align: right;">-</td>
                <td style="padding: 10px; border: 1px solid #dadce0; text-align: right;">-</td>
                <td style="padding: 10px; border: 1px solid #dadce0; font-weight: bold; color: #5f6368;">SKIPPED</td>
            </tr>
        `).join('')

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Filter Validation Execution Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #202124; }
        h1 { color: #1a73e8; }
        .summary-card { display: flex; gap: 20px; margin-bottom: 24px; }
        .stat-box { background: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; padding: 16px 24px; flex: 1; text-align: center; }
        .stat-number { font-size: 28px; font-weight: bold; margin-top: 8px; }
        .stat-pass { color: #137333; }
        .stat-fail { color: #c5221f; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #1a73e8; color: white; padding: 12px; text-align: left; }
    </style>
</head>
<body>
    <h1>CartoBike Filter Validation Report - Test Case 1</h1>
    <div class="summary-card">
        <div class="stat-box"><div>Identified</div><div class="stat-number">${totalIdentified}</div></div>
        <div class="stat-box"><div>Tested</div><div class="stat-number">${totalTested}</div></div>
        <div class="stat-box"><div>Passed</div><div class="stat-number stat-pass">${totalPassed}</div></div>
        <div class="stat-box"><div>Failed</div><div class="stat-number stat-fail">${totalFailed}</div></div>
        <div class="stat-box"><div>Skipped</div><div class="stat-number">${totalSkipped}</div></div>
    </div>
    <table>
        <thead>
            <tr>
                <th>Filter</th>
                <th>Selected Value</th>
                <th style="text-align: right;">Total Results</th>
                <th style="text-align: right;">Matching Results</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
            ${skippedRows}
        </tbody>
    </table>
</body>
</html>`
    }

    public saveAndAttachReports (): void {
        const md = this.generateSummaryMarkdown()
        addAttachment('Filter Validation Summary Report', md, 'text/markdown')
        console.log('\n' + md + '\n')

        try {
            const html = this.generateHtmlReport()
            const reportDir = path.resolve(process.cwd(), 'allure-results')
            if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
            const reportPath = path.join(reportDir, 'filter-validation-report.html')
            fs.writeFileSync(reportPath, html, 'utf-8')
            addAttachment('Filter Validation HTML Report', html, 'text/html')
        } catch (err) {
            console.warn('Could not save HTML report to disk:', err)
        }
    }
}

export const filterReporter = new FilterValidationReporter()

