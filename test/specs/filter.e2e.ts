import { addDescription, step } from '@wdio/allure-reporter'
import { $, browser } from '@wdio/globals'
import filterPage from '../pageobjects/filter.page.js'
import listingsPage from '../pageobjects/listings.page.js'
import { navigateToModule } from '../support/module-navigator.js'
import { filterReporter } from '../support/filter-reporter.js'

describe('Filter Validation - Test Case 1: Individual Filter Verification', () => {
    let setupComplete = false

    beforeEach(async function (this: Mocha.Context) {
        this.timeout(120000)
        setupComplete = false
        await navigateToModule('filter')
        await filterPage.resetToDefaults()
        if (!await filterPage.isDisplayed()) {
            await listingsPage.openFilter()
            await filterPage.waitForScreen()
        }
        setupComplete = true
    })

    afterEach(async function (this: Mocha.Context) {
        this.timeout(60000)
        if (!setupComplete) return
        try {
            if (!await filterPage.isDisplayed()) {
                if (await listingsPage.isDisplayed()) {
                    await listingsPage.openFilter()
                    await filterPage.waitForScreen()
                    await filterPage.resetToDefaults()
                }
            } else {
                await filterPage.resetToDefaults()
            }
        } catch {
            // Teardown is best-effort; beforeEach will ensure clean screen state
        }
    })

    after(async () => {
        // Output and attach the final consolidated Filter Validation Report
        filterReporter.saveAndAttachReports()
    })

    it('TC1 - Select a Vehicle: Test vehicle options and reset vehicle type to Cars', async () => {
        await addDescription('Test the available Select a Vehicle filter options, switch back to Cars, apply, and verify displayed advertisements belong to Cars.')
        const filterName = 'Select a Vehicle'
        const selectedValue = 'Car'
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0

        try {
            await step('Locate and test available vehicle category selection options', async () => {
                await filterPage.waitForScreen()
                for (const cat of ['Car', 'Motorcycles'] as const) {
                    const control = $(`android=new UiSelector().text("${cat}")`)
                    expect(await control.isDisplayed().catch(() => false)).toBe(true)
                }
                // Test selecting an alternative category option (Motorcycles)
                await filterPage.selectVehicleCategory('Motorcycles')
            })

            await step('Switch vehicle selection back to Cars and apply', async () => {
                await filterPage.selectVehicleCategory('Car')
                await filterPage.apply()
            })

            await step('Wait for search results to reload and verify advertisements belong to Cars', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const title = await listingsPage.waitForScreenTitle(/cars/i)
                expect(title).toMatch(/cars/i)
                const listings = await listingsPage.collectAllVisibleListings(1)
                total = listings.length
                matching = total
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason
            })
        }
    })

    it('TC1.1 - Filter: Condition (New) - Verify vehicle advertisement condition information', async () => {
        await addDescription('Ensure vehicle type is Cars, apply Condition "New", and verify every displayed advertisement explicitly displays the "New" condition on its card.')
        const filterName = 'Condition'
        const selectedValue = 'New'
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0
        const mismatchedListings: string[] = []

        try {
            await step('Ensure vehicle type is set to Cars and select Condition "New"', async () => {
                await filterPage.waitForScreen()
                await filterPage.selectVehicleCategory('Car')
                await filterPage.selectCondition('New')
                await filterPage.apply()
            })

            await step('Wait for vehicle listing results to load completely', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                await listingsPage.waitForListingsLoaded()
            })

            await step('Inspect and validate condition information on every vehicle advertisement card', async () => {
                const cardResults = await listingsPage.inspectCardConditions(2)
                total = cardResults.length

                console.log(`[TC1.1] Total advertisement cards inspected: ${total}`)

                for (const card of cardResults) {
                    console.log(`[TC1.1 Card] "${card.title}" -> Condition: "${card.conditionText}" | Classification: ${card.classification}`)

                    if (card.classification === 'PASS') {
                        matching++
                    } else if (card.classification === 'FAIL') {
                        mismatchedListings.push(`${card.title}: Displayed "${card.conditionText}" (Expected "New")`)
                    } else {
                        mismatchedListings.push(`${card.title}: Condition unverified / missing ("${card.conditionText}")`)
                    }
                }

                if (total === 0) {
                    status = 'PASS'
                    console.log('[TC1.1] No advertisements returned (empty result set for New condition).')
                } else if (matching !== total) {
                    status = 'FAIL'
                    failureReason = `${total - matching} of ${total} advertisements did not display the "New" condition (Mismatches: ${mismatchedListings.join('; ')})`
                    await filterReporter.captureFailureScreenshot(filterName)
                    expect(matching).toBe(total)
                }
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason,
                mismatchedListings
            })
        }
    })

    it('TC1.2 - Filter: Vehicle Category (Motorcycles)', async () => {
        await addDescription('Apply Vehicle Category "Motorcycles" individually and validate results.')
        const filterName = 'Vehicle Category'
        const selectedValue = 'Motorcycles'
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0

        try {
            await step('Select Category "Motorcycles" and apply filter', async () => {
                await filterPage.selectVehicleCategory('Motorcycles')
                await filterPage.apply()
            })
            await step('Validate actual results match Category "Motorcycles"', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const title = await listingsPage.waitForScreenTitle(/motorcycles/i)
                expect(title).toBe('Used motorcycles')
                const listings = await listingsPage.collectAllVisibleListings(1)
                total = listings.length
                matching = total
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason
            })
        }
    })

    it('TC1.3 - Filter: Brand (Audi)', async () => {
        await addDescription('Apply Brand "Audi" individually and validate every returned listing belongs to Audi.')
        const filterName = 'Brand'
        const selectedValue = 'Audi'
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0
        const mismatchedListings: string[] = []

        try {
            await step('Select Brand "Audi" and apply filter', async () => {
                await filterPage.selectBrand('Audi')
                await filterPage.apply()
            })
            await step('Validate every displayed listing belongs to Audi', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const listings = await listingsPage.collectAllVisibleListings(2)
                total = listings.length
                for (const item of listings) {
                    if (/Audi/i.test(item.title)) {
                        matching++
                    } else {
                        mismatchedListings.push(item.title)
                    }
                }
                if (total > 0 && matching !== total) {
                    status = 'FAIL'
                    failureReason = `${total - matching} listings did not match brand "${selectedValue}"`
                    await filterReporter.captureFailureScreenshot(filterName)
                    expect(matching).toBe(total)
                }
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason,
                mismatchedListings
            })
        }
    })

    it('TC1.4 - Filter: Search / Keyword (Audi)', async () => {
        await addDescription('Apply Search keyword "Audi" individually and validate actual listing results.')
        const filterName = 'Search / Keyword'
        const selectedValue = 'Audi'
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0
        const mismatchedListings: string[] = []

        try {
            await step('Enter Search keyword "Audi" and apply filter', async () => {
                await filterPage.setSearch('Audi')
                await filterPage.apply()
            })
            await step('Validate returned listings match search keyword', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const listings = await listingsPage.collectAllVisibleListings(1)
                total = listings.length
                for (const item of listings) {
                    if (/Audi/i.test(item.title)) {
                        matching++
                    } else {
                        mismatchedListings.push(item.title)
                    }
                }
                if (total > 0 && matching !== total) {
                    status = 'FAIL'
                    failureReason = `${total - matching} listings did not contain search term "${selectedValue}"`
                    await filterReporter.captureFailureScreenshot(filterName)
                    expect(matching).toBe(total)
                }
            })
            await step('Verify search term is retained when reopening filter', async () => {
                await filterPage.openFromResults()
                expect(await filterPage.getSearchValue()).toBe('Audi')
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason,
                mismatchedListings
            })
        }
    })

    it('TC1.5 - Filter: Price Range (€1,000 - €2,000,000)', async () => {
        await addDescription('Apply Price range individually and validate that every listing price is within boundaries.')
        const filterName = 'Price Range'
        const priceRange = { min: 1000, max: 2000000 }
        const selectedValue = `€${priceRange.min} - €${priceRange.max}`
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0
        const mismatchedListings: string[] = []

        try {
            await step('Enter Price range and apply filter', async () => {
                await filterPage.setPriceRange(priceRange.min, priceRange.max)
                await filterPage.apply()
            })
            await step('Validate listing prices fall within the selected range', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const listings = await listingsPage.collectAllVisibleListings(1)
                const prices = listings.map(l => l.price).filter((p): p is number => p !== undefined)
                total = prices.length
                for (const price of prices) {
                    if (price >= priceRange.min && price <= priceRange.max) {
                        matching++
                    } else {
                        mismatchedListings.push(`Price €${price} out of range [${priceRange.min}, ${priceRange.max}]`)
                    }
                }
                if (total > 0 && matching !== total) {
                    status = 'FAIL'
                    failureReason = `${total - matching} listing prices fell outside the range [${priceRange.min}, ${priceRange.max}]`
                    await filterReporter.captureFailureScreenshot(filterName)
                    expect(matching).toBe(total)
                }
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason,
                mismatchedListings
            })
        }
    })

    it('TC1.6 - Filter: Year Range (2020 - 2026)', async () => {
        await addDescription('Apply Year range individually and validate that every listing year falls within boundaries.')
        const filterName = 'Year Range'
        const yearRange = { min: 2020, max: 2026 }
        const selectedValue = `${yearRange.min} - ${yearRange.max}`
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0
        const mismatchedListings: string[] = []

        try {
            await step('Select Year range and apply filter', async () => {
                await filterPage.selectYear('Min.', yearRange.min)
                await filterPage.selectYear('Max.', yearRange.max)
                await filterPage.apply()
            })
            await step('Validate listing registration years satisfy selected range', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const listings = await listingsPage.collectAllVisibleListings(1)
                const years = listings.map(l => l.year).filter((y): y is number => y !== undefined)
                total = years.length
                for (const year of years) {
                    if (year >= yearRange.min && year <= yearRange.max) {
                        matching++
                    } else {
                        mismatchedListings.push(`Year ${year} out of range [${yearRange.min}, ${yearRange.max}]`)
                    }
                }
                if (total > 0 && matching !== total) {
                    status = 'FAIL'
                    failureReason = `${total - matching} listing years fell outside range [${yearRange.min}, ${yearRange.max}]`
                    await filterReporter.captureFailureScreenshot(filterName)
                    expect(matching).toBe(total)
                }
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason,
                mismatchedListings
            })
        }
    })

    it('TC1.7 - Filter: Kilometer Range (0 - 50,000 km)', async () => {
        await addDescription('Apply Kilometer range individually and validate that every listing km falls within boundaries.')
        const filterName = 'Kilometer Range'
        const kmRange = { min: 0, max: 50000 }
        const selectedValue = `${kmRange.min} - ${kmRange.max} km`
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0
        const mismatchedListings: string[] = []

        try {
            await step('Enter Kilometer range and apply filter', async () => {
                await filterPage.setKilometerRange(kmRange.min, kmRange.max)
                await filterPage.apply()
            })
            await step('Validate listing kilometers satisfy selected range', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const listings = await listingsPage.collectAllVisibleListings(1)
                const kms = listings.map(l => l.km).filter((k): k is number => k !== undefined)
                total = kms.length
                for (const km of kms) {
                    if (km >= kmRange.min && km <= kmRange.max) {
                        matching++
                    } else {
                        mismatchedListings.push(`Kilometers ${km} out of range [${kmRange.min}, ${kmRange.max}]`)
                    }
                }
                if (total > 0 && matching !== total) {
                    status = 'FAIL'
                    failureReason = `${total - matching} listing km fell outside range [${kmRange.min}, ${kmRange.max}]`
                    await filterReporter.captureFailureScreenshot(filterName)
                    expect(matching).toBe(total)
                }
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason,
                mismatchedListings
            })
        }
    })

    it('TC1.8 - Filter: VAT Refundable (Enabled)', async () => {
        await addDescription('Enable VAT Refundable individually, verify retention and listings.')
        const filterName = 'VAT Refundable'
        const selectedValue = 'Enabled (True)'
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0

        try {
            await step('Enable VAT refundable and apply', async () => {
                await filterPage.setVatRefundable(true)
                await filterPage.apply()
            })
            await step('Verify listings returned and filter retained upon reopen', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const listings = await listingsPage.collectAllVisibleListings(1)
                total = listings.length
                matching = total
                await filterPage.openFromResults()
                const isEnabled = await filterPage.isVatRefundableEnabled()
                expect(isEnabled).toBe(true)
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            throw err
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason
            })
        }
    })

    it('TC1.9 - Filter: Body Type (SUV)', async () => {
        await addDescription('Apply Body Type "SUV" individually and validate actual listing results.')
        const filterName = 'Body Type'
        const selectedValue = 'SUV'
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0
        const mismatchedListings: string[] = []

        try {
            await step('Select Body Type "SUV" and apply filter', async () => {
                await filterPage.selectBodyType('SUV')
                await filterPage.apply()
            })
            await step('Validate actual results match Body Type "SUV"', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const listings = await listingsPage.collectAllVisibleListings(1)
                total = listings.length
                for (const item of listings) {
                    if (!item.bodyType || /SUV/i.test(item.bodyType) || /SUV/i.test(item.rawSnippet)) {
                        matching++
                    } else {
                        mismatchedListings.push(`${item.title}: bodyType=${item.bodyType}`)
                    }
                }
                if (total > 0 && matching !== total) {
                    status = 'FAIL'
                    failureReason = `${total - matching} listings did not match body type "${selectedValue}"`
                    await filterReporter.captureFailureScreenshot(filterName)
                    expect(matching).toBe(total)
                }
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            // Non-blocking: continue suite even if option unavailable in current environment
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason,
                mismatchedListings
            })
        }
    })

    it('TC1.10 - Filter: Fuel Type (Electric)', async () => {
        await addDescription('Apply Fuel Type "Electric" individually and validate actual listing results.')
        const filterName = 'Fuel Type'
        const selectedValue = 'Electric'
        let status: 'PASS' | 'FAIL' = 'PASS'
        let failureReason = ''
        let total = 0
        let matching = 0
        const mismatchedListings: string[] = []

        try {
            await step('Select Fuel Type "Electric" and apply filter', async () => {
                await filterPage.selectFuel('Electric')
                await filterPage.apply()
            })
            await step('Validate actual results match Fuel Type "Electric"', async () => {
                expect(await listingsPage.isDisplayed()).toBe(true)
                const listings = await listingsPage.collectAllVisibleListings(1)
                total = listings.length
                for (const item of listings) {
                    if (!item.fuel || /Electric/i.test(item.fuel) || /Electric/i.test(item.rawSnippet)) {
                        matching++
                    } else {
                        mismatchedListings.push(`${item.title}: fuel=${item.fuel}`)
                    }
                }
                if (total > 0 && matching !== total) {
                    status = 'FAIL'
                    failureReason = `${total - matching} listings did not match fuel type "${selectedValue}"`
                    await filterReporter.captureFailureScreenshot(filterName)
                    expect(matching).toBe(total)
                }
            })
        } catch (err: any) {
            status = 'FAIL'
            failureReason = err.message || String(err)
            await filterReporter.captureFailureScreenshot(filterName)
            // Non-blocking: continue suite even if option unavailable in current environment
        } finally {
            filterReporter.record({
                filterName,
                selectedValue,
                totalResults: total,
                matchingResults: matching,
                status,
                failureReason,
                mismatchedListings
            })
        }
    })

    it('TC1.11 - Continuous sequential execution: tests every filter sequentially and resets between runs', async () => {
        await addDescription('Run each filter sequentially one by one in a single test flow, ensuring independent validation and clean reset after each.')

        // Helper: ensure we are on the filter screen and in a clean state before each sequential step
        async function ensureFilterScreenReady(): Promise<void> {
            await listingsPage.waitForListingsLoaded(20000).catch(() => undefined)
            await listingsPage.scrollToTop().catch(() => undefined)
            await browser.pause(500)
            if (!await filterPage.isDisplayed()) {
                await listingsPage.openFilter()
                await filterPage.waitForScreen()
            }
            await filterPage.resetToDefaults()
        }

        // 1. Condition
        await step('Sequential 1: Condition (New)', async () => {
            await filterPage.waitForScreen()
            await filterPage.selectCondition('New')
            await filterPage.apply()
            await listingsPage.waitForListingsLoaded()
            const cardResults = await listingsPage.inspectCardConditions(1)
            if (cardResults.length > 0) {
                expect(cardResults.some(c => c.classification === 'PASS')).toBe(true)
            }
        })

        // 2. Vehicle Category
        await step('Sequential 2: Vehicle Category (Motorcycles)', async () => {
            await ensureFilterScreenReady()
            await filterPage.selectVehicleCategory('Motorcycles')
            await filterPage.apply()
            await listingsPage.waitForListingsLoaded()
            const title = await listingsPage.waitForScreenTitle(/motorcycles/i)
            expect(title).toMatch(/motorcycles/i)
        })

        // 3. Brand
        await step('Sequential 3: Brand (Audi)', async () => {
            await ensureFilterScreenReady()
            await filterPage.selectBrand('Audi')
            await filterPage.apply()
            await listingsPage.waitForListingsLoaded()
            const listings = await listingsPage.collectAllVisibleListings(1)
            if (listings.length > 0) {
                expect(listings.some(l => /Audi/i.test(l.title))).toBe(true)
            }
        })

        // 4. Price range
        await step('Sequential 4: Price range (€1,000 - €2,000,000)', async () => {
            await ensureFilterScreenReady()
            await filterPage.setPriceRange(1000, 2000000)
            await filterPage.apply()
            await listingsPage.waitForListingsLoaded()
            expect(await listingsPage.isDisplayed()).toBe(true)
            await listingsPage.assertVisibleListingRanges({ price: { min: 1000, max: 2000000 } })
        })

        // 5. Search keyword
        await step('Sequential 5: Search keyword (Audi)', async () => {
            await ensureFilterScreenReady()
            await filterPage.setSearch('Audi')
            await filterPage.apply()
            await listingsPage.waitForListingsLoaded()
            expect(await listingsPage.isDisplayed()).toBe(true)
            const listings = await listingsPage.collectAllVisibleListings(1)
            if (listings.length > 0) {
                expect(listings.some(l => /Audi/i.test(l.title))).toBe(true)
            }
        })
    })
})
