import BasePage from './base.page.js'
import { $, browser, driver } from '@wdio/globals'

/** Controls and observable listing results on the vehicle results screen. */
class ListingsPage extends BasePage {
    public async isDisplayed(): Promise<boolean> {
        const title = await this.getScreenTitle()
        if (title !== null) return true
        const source = await driver.getPageSource().catch(() => '')
        const hasListings = /€\s*[\d .]+/.test(source) || /[\d ]+\s*KM\b/i.test(source)
        return hasListings
    }

    private async findScreenTitleElement(): Promise<WebdriverIO.Element | null> {
        for (const label of ['New cars', 'Used cars', 'New motorcycles', 'Used motorcycles', 'New bikes', 'Used bikes']) {
            const element = $(`android=new UiSelector().text("${label}")`)
            if (await element.isDisplayed().catch(() => false)) return element
        }
        return null
    }

    public async scrollToTop(): Promise<void> {
        try {
            const source = await driver.getPageSource()
            const rootBounds = source.match(/bounds="\[0,0\]\[(\d+),(\d+)\]"/)
            if (!rootBounds) return
            const width = Number(rootBounds[1])
            const height = Number(rootBounds[2])
            await browser.execute('mobile: scrollGesture', {
                left: Math.round(width * 0.2),
                top: Math.round(height * 0.2),
                width: Math.round(width * 0.6),
                height: Math.round(height * 0.6),
                direction: 'up',
                percent: 1.0
            })
        } catch {
            // Ignore scroll errors
        }
    }

    public async openFilter(): Promise<void> {
        if (!await this.isDisplayed()) {
            const title = await this.getScreenTitle()
            throw new Error(`Expected the listings screen before opening Filter; current heading: ${title ?? 'unrecognized'}.`)
        }

        // Scroll back to top to ensure header and filter button are in view
        await this.scrollToTop().catch(() => undefined)

        // Try clicking the Filter button by locator first
        const filterBtn = $('android=new UiSelector().textContains("Filter")')
        const filterDesc = $('android=new UiSelector().descriptionContains("Filter")')
        const filterAcc = $('~Filter')

        if (await filterBtn.isDisplayed().catch(() => false)) {
            await filterBtn.click()
        } else if (await filterDesc.isDisplayed().catch(() => false)) {
            await filterDesc.click()
        } else if (await filterAcc.isDisplayed().catch(() => false)) {
            await filterAcc.click()
        } else {
            // Fallback: top-right coordinate click
            const source = await driver.getPageSource()
            const rootBounds = source.match(/bounds="\[0,0\]\[(\d+),(\d+)\]"/)
            if (!rootBounds) throw new Error('Could not read the listings screen dimensions to locate Filter.')
            const width = Number(rootBounds[1])
            const height = Number(rootBounds[2])
            await browser.execute('mobile: clickGesture', {
                x: Math.round(width * 0.902),
                y: Math.round(height * 0.12)
            })
        }
    }

    public async getScreenTitle(): Promise<string | null> {
        const element = await this.findScreenTitleElement()
        if (element) {
            const text = await element.getText().catch(() => '')
            if (text) return text
        }
        const source = await driver.getPageSource().catch(() => '')
        const match = source.match(/text="(New cars|Used cars|New motorcycles|Used motorcycles|New bikes|Used bikes)"/)
        return match ? match[1] : null
    }

    public async waitForScreenTitle(expected?: string | RegExp, timeout = 15000): Promise<string> {
        let lastTitle: string | null = null
        await browser.waitUntil(async () => {
            lastTitle = await this.getScreenTitle()
            if (!lastTitle) return false
            if (!expected) return true
            if (typeof expected === 'string') return lastTitle === expected
            return expected.test(lastTitle)
        }, {
            timeout,
            interval: 300,
            timeoutMsg: `Expected screen title "${expected ?? 'any'}" but got "${lastTitle ?? 'none'}" within ${timeout}ms.`
        })
        return lastTitle!
    }

    public async isVehicleDetailsDisplayed(): Promise<boolean> {
        const source = await driver.getPageSource().catch(() => '')
        return source.includes('text="Highlights"') && source.includes('text="Call"')
    }

    public async visibleListingLabels(): Promise<string[]> {
        const source = await driver.getPageSource()
        const labels: string[] = []
        for (const match of source.matchAll(/<node\b([^>]*)>/g)) {
            const attributes = match[1] ?? ''
            const isListingNode = /class="android\.view\.ViewGroup"/.test(attributes) &&
                /clickable="true"/.test(attributes)
            if (!isListingNode) continue
            const description = attributes.match(/content-desc="([^"]+)"/)?.[1]
            if (!description) continue
            const label = description
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#(\d+);/g, (_entity, code: string) => String.fromCodePoint(Number(code)))
            if (/^[\p{L}\p{N}][\p{L}\p{N} ()'.,&/-]{3,}$/u.test(label)) labels.push(label)
        }
        return [...new Set(labels)]
    }

    public async assertVisibleListingRanges(ranges: {
        price?: { min: number, max: number }
        year?: { min: number, max: number }
        km?: { min: number, max: number }
    }): Promise<void> {
        const source = await driver.getPageSource()
        const prices = [...source.matchAll(/€\s*([\d .]+)/g)]
            .map(match => Number((match[1] ?? '').replace(/\D/g, '')))
            .filter(Number.isFinite)
        const years = [...source.matchAll(/\b\d{2}\/(20\d{2})\b/g)]
            .map(match => Number(match[1]))
            .filter(Number.isFinite)
        const kilometers = [...source.matchAll(/([\d ]+)\s*KM\b/gi)]
            .map(match => Number((match[1] ?? '').replace(/\D/g, '')))
            .filter(Number.isFinite)

        for (const [label, values, range] of [
            ['price', prices, ranges.price],
            ['year', years, ranges.year],
            ['km', kilometers, ranges.km]
        ] as const) {
            if (!range || values.length === 0) continue
            for (const value of values) {
                if (value < range.min || value > range.max) {
                    throw new Error(`Visible listing ${label} ${value} should be within ${range.min}-${range.max}`)
                }
                expect(value).toBeGreaterThanOrEqual(range.min)
                expect(value).toBeLessThanOrEqual(range.max)
            }
        }
    }

    public async scrollResultsDown(): Promise<boolean> {
        try {
            const source = await driver.getPageSource()
            const rootBounds = source.match(/bounds="\[0,0\]\[(\d+),(\d+)\]"/)
            if (!rootBounds) return false
            const width = Number(rootBounds[1])
            const height = Number(rootBounds[2])
            await browser.execute('mobile: scrollGesture', {
                left: Math.round(width * 0.1),
                top: Math.round(height * 0.3),
                width: Math.round(width * 0.8),
                height: Math.round(height * 0.5),
                direction: 'down',
                percent: 0.8
            })
            return true
        } catch {
            return false
        }
    }

    public async collectAllVisibleListings(maxScrolls = 2): Promise<{
        title: string
        condition?: string
        price?: number
        year?: number
        km?: number
        fuel?: string
        transmission?: string
        bodyType?: string
        rawSnippet: string
    }[]> {
        const collected = new Map<string, any>()
        for (let scroll = 0; scroll <= maxScrolls; scroll++) {
            const source = await driver.getPageSource()
            for (const match of source.matchAll(/<node\b([^>]*)>(.*?)<\/node>/gs)) {
                const nodeAttrs = match[1] ?? ''
                const nodeInner = match[2] ?? ''
                const fullText = `${nodeAttrs} ${nodeInner}`
                const desc = nodeAttrs.match(/content-desc="([^"]+)"/)?.[1]
                if (!desc || !/^[\p{L}\p{N}][\p{L}\p{N} ()'.,&/-]{3,}$/u.test(desc)) continue
                if (['New cars', 'Used cars', 'New motorcycles', 'Used motorcycles', 'Filter'].includes(desc)) continue

                const conditionMatch = fullText.match(/\b(New|Used)\b/i)
                const condition = conditionMatch ? (conditionMatch[1].toLowerCase() === 'new' ? 'New' : 'Used') : undefined

                const priceMatch = fullText.match(/€\s*([\d .]+)/)
                const price = priceMatch ? Number(priceMatch[1].replace(/\D/g, '')) : undefined

                const yearMatch = fullText.match(/\b\d{2}\/(20\d{2})\b/)
                const year = yearMatch ? Number(yearMatch[1]) : undefined

                const kmMatch = fullText.match(/([\d ]+)\s*KM\b/i)
                const km = kmMatch ? Number(kmMatch[1].replace(/\D/g, '')) : undefined

                const fuelMatch = fullText.match(/\b(Diesel|Petrol|Electric|Hybrid|LPG|CNG)\b/i)
                const fuel = fuelMatch ? fuelMatch[1] : undefined

                const transMatch = fullText.match(/\b(Automatic|Manual)\b/i)
                const transmission = transMatch ? transMatch[1] : undefined

                const bodyMatch = fullText.match(/\b(SUV|Sedan|Hatchback|Station wagon|Coupe|Convertible)\b/i)
                const bodyType = bodyMatch ? bodyMatch[1] : undefined

                if (!collected.has(desc)) {
                    collected.set(desc, {
                        title: desc,
                        condition,
                        price,
                        year,
                        km,
                        fuel,
                        transmission,
                        bodyType,
                        rawSnippet: fullText.slice(0, 300)
                    })
                }
            }
            if (scroll < maxScrolls) {
                const scrolled = await this.scrollResultsDown()
                if (!scrolled) break
            }
        }
        return Array.from(collected.values())
    }

    public async waitForListingsLoaded(timeout = 20000): Promise<void> {
        await browser.waitUntil(async () => {
            const source = await driver.getPageSource().catch(() => '')
            return /€\s*[\d .]+/.test(source) || /[\d ]+\s*KM\b/i.test(source) || /text="New"/i.test(source)
        }, {
            timeout,
            interval: 500,
            timeoutMsg: 'Vehicle advertisement results did not load within timeout.'
        })
    }

    public async inspectCardConditions(maxScrolls = 2): Promise<{
        title: string
        conditionText: string
        classification: 'PASS' | 'FAIL' | 'UNVERIFIED'
        rawSnippet: string
    }[]> {
        const resultsMap = new Map<string, {
            title: string
            conditionText: string
            classification: 'PASS' | 'FAIL' | 'UNVERIFIED'
            rawSnippet: string
        }>()

        for (let scroll = 0; scroll <= maxScrolls; scroll++) {
            const source = await driver.getPageSource()
            const cardRegex = /<node\b([^>]*)>(.*?)<\/node>/gs
            for (const match of source.matchAll(cardRegex)) {
                const nodeAttrs = match[1] ?? ''
                const nodeInner = match[2] ?? ''
                const fullCard = `${nodeAttrs} ${nodeInner}`

                const desc = nodeAttrs.match(/content-desc="([^"]+)"/)?.[1]
                if (!desc || !/^[\p{L}\p{N}][\p{L}\p{N} ()'.,&/-]{3,}$/u.test(desc)) continue
                if (['New cars', 'Used cars', 'New motorcycles', 'Used motorcycles', 'Filter'].includes(desc)) continue

                let conditionText = ''
                let classification: 'PASS' | 'FAIL' | 'UNVERIFIED' = 'UNVERIFIED'

                // Look for specifications line: e.g. "New • ..." or "05/2022 • ..."
                const specsMatch = fullCard.match(/(?:text|content-desc)="((?:New|[0-9]{1,2}\/[0-9]{4})[^\n"•]*•[^\n"]*)"/i) ||
                                   fullCard.match(/\b(New|[0-9]{1,2}\/[0-9]{4})\s*•\s*[^\n<"]+/i)

                if (specsMatch) {
                    const rawLine = specsMatch[1] ?? specsMatch[0]
                    const firstToken = rawLine.split('•')[0].trim()

                    if (/^New$/i.test(firstToken) || firstToken.toLowerCase() === 'new') {
                        conditionText = 'New'
                        classification = 'PASS'
                    } else if (/\b(0?[1-9]|1[0-2])\/(20\d{2}|19\d{2})\b/.test(firstToken)) {
                        conditionText = firstToken
                        classification = 'FAIL'
                    } else {
                        conditionText = firstToken
                        classification = 'UNVERIFIED'
                    }
                } else {
                    const standaloneNew = /(?:text|content-desc)="New"/i.test(fullCard)
                    const dateMatch = fullCard.match(/\b(0?[1-9]|1[0-2])\/(20\d{2}|19\d{2})\b/)

                    if (standaloneNew && !dateMatch) {
                        conditionText = 'New'
                        classification = 'PASS'
                    } else if (dateMatch) {
                        conditionText = dateMatch[0]
                        classification = 'FAIL'
                    } else {
                        conditionText = 'Missing / unreadable'
                        classification = 'UNVERIFIED'
                    }
                }

                if (!resultsMap.has(desc)) {
                    resultsMap.set(desc, {
                        title: desc,
                        conditionText,
                        classification,
                        rawSnippet: fullCard.slice(0, 300)
                    })
                }
            }

            if (scroll < maxScrolls) {
                const scrolled = await this.scrollResultsDown()
                if (!scrolled) break
            }
        }

        return Array.from(resultsMap.values())
    }
}

export default new ListingsPage()
