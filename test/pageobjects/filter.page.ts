import BasePage from './base.page.js'
import { $, browser, driver } from '@wdio/globals'
import listingsPage from './listings.page.js'
import homePage from './home.page.js'
import { appData } from '../data/app.data.js'

type Condition = 'New' | 'Used'
type VehicleCategory = 'Car' | 'Motorcycles' | 'Bike'
type RangeBound = 'Min.' | 'Max.'

/** Interactions for CartoBike's Filter screen and its choice sheets. */
class FilterPage extends BasePage {
    public get title () { return $('android=new UiSelector().text("Filter")') }
    public get searchInput () { return $('android=new UiSelector().className("android.widget.EditText").instance(0)') }
    public get priceMinInput () { return $('android=new UiSelector().className("android.widget.EditText").text("\u20ac Min.")') }
    public get priceMaxInput () { return $('android=new UiSelector().className("android.widget.EditText").text("\u20ac Max.")') }
    public get kmMinInput () { return $('android=new UiSelector().className("android.widget.EditText").text("Min.")') }
    public get kmMaxInput () { return $('android=new UiSelector().className("android.widget.EditText").text("Max.")') }
    public get vatRefundableSwitch () { return $('android=new UiSelector().className("android.widget.Switch")') }
    public get chooseBrandTitle () { return $('android=new UiSelector().text("Choose Brand")') }
    public get clearAllButton () { return $('~Clear all') }
    public get applyButton () { return $('~Apply') }

    public async isDisplayed (): Promise<boolean> {
        if (await this.title.isDisplayed().catch(() => false)) return true
        if (await this.clearAllButton.isDisplayed().catch(() => false)) return true
        if (await this.applyButton.isDisplayed().catch(() => false)) return true
        const clearAllText = $('android=new UiSelector().textContains("Clear all")')
        return clearAllText.isDisplayed().catch(() => false)
    }

    public async waitForScreen (): Promise<void> {
        await browser.waitUntil(async () => await this.isDisplayed(), {
            timeout: 20000,
            interval: 300,
            timeoutMsg: 'Filter screen was not displayed within 20000ms.'
        })
        await this.applyButton.waitForDisplayed({ timeout: 10000 }).catch(() => undefined)
    }

    /** Start from the existing listings route; preserve a clear setup error for other app screens. */
    public async openFromListings (): Promise<void> {
        await this.launchApp(appData.packageName)
        for (let attempt = 0; attempt < 5; attempt += 1) {
            if (await homePage.isVehicleSearchFormDisplayed()) {
                await homePage.openDefaultVehicleListings()
                await browser.waitUntil(async () => await listingsPage.isDisplayed(), {
                    timeout: 20000,
                    interval: 300,
                    timeoutMsg: 'Home vehicle search did not open the listings screen.'
                })
                await listingsPage.openFilter()
                await this.waitForScreen()
                return
            }
            if (await homePage.isHomeTabAvailable()) {
                await homePage.openVehicleSearchHome()
            } else {
                await driver.back()
            }
        }
        throw new Error('Could not reach CartoBike Home and open the default vehicle listings to access Filter.')
    }

    public async isChoiceSheetDisplayed (): Promise<boolean> {
        const title = $('android=new UiSelector().textContains("Choose")')
        return title.isDisplayed().catch(() => false)
    }

    public async selectBodyType (bodyType: string): Promise<void> {
        await this.assertLowerControlsVisible().catch(() => undefined)
        await this.openChoiceSection('Body type')
        const option = $(`android=new UiSelector().text("${bodyType}")`)
        const descOption = $(`~${bodyType}`)
        if (await option.isDisplayed().catch(() => false)) {
            await option.click()
        } else {
            await descOption.waitForDisplayed()
            await descOption.click()
        }
        await browser.waitUntil(async () => !await this.isChoiceSheetDisplayed(), {
            timeout: 5000,
            interval: 200,
            timeoutMsg: `Selecting ${bodyType} did not close the body type picker.`
        }).catch(() => undefined)
    }

    public async selectFuel (fuel: string): Promise<void> {
        await this.assertLowerControlsVisible().catch(() => undefined)
        await this.openChoiceSection('Fuel')
        const option = $(`android=new UiSelector().text("${fuel}")`)
        const descOption = $(`~${fuel}`)
        if (await option.isDisplayed().catch(() => false)) {
            await option.click()
        } else {
            await descOption.waitForDisplayed()
            await descOption.click()
        }
        await browser.waitUntil(async () => !await this.isChoiceSheetDisplayed(), {
            timeout: 5000,
            interval: 200,
            timeoutMsg: `Selecting ${fuel} did not close the fuel picker.`
        }).catch(() => undefined)
    }

    public async closeChoiceSheet (): Promise<void> {
        const source = await driver.getPageSource()
        const rootBounds = source.match(/bounds="\[0,0\]\[(\d+),(\d+)\]"/)
        if (!rootBounds) throw new Error('Could not read the screen dimensions to close the filter choice sheet.')
        const width = Number(rootBounds[1])
        const height = Number(rootBounds[2])
        await browser.execute('mobile: clickGesture', {
            x: Math.round(width * 0.91),
            y: Math.round(height * 0.30)
        })
    }

    public async selectCondition (condition: Condition): Promise<void> {
        const textControl = $(`android=new UiSelector().text("${condition}")`)
        if (await textControl.isDisplayed().catch(() => false)) {
            await textControl.click()
            return
        }
        const control = $(`android=new UiSelector().descriptionContains("${condition}")`)
        await control.waitForDisplayed()
        await control.click()
    }

    public async selectVehicleCategory (category: VehicleCategory): Promise<void> {
        const control = $(`~${category}`)
        if (await control.isDisplayed().catch(() => false)) {
            await control.click()
            return
        }
        const textControl = $(`android=new UiSelector().text("${category}")`)
        await textControl.waitForDisplayed()
        await textControl.click()
    }

    public async openChoiceSection (section: 'Brand' | 'Body type' | 'Fuel'): Promise<void> {
        const control = $(`android=new UiSelector().descriptionContains("${section}")`)
        await control.waitForDisplayed()
        await control.click()
    }

    public async selectBrand (brand: string): Promise<void> {
        await this.openChoiceSection('Brand')
        await this.chooseBrandTitle.waitForDisplayed()
        const option = $(`~${brand}`)
        await option.waitForDisplayed()
        await option.click()
        await browser.waitUntil(async () => !await this.isChoiceSheetDisplayed(), {
            timeout: 5000,
            interval: 200,
            timeoutMsg: `Selecting ${brand} did not close the brand picker.`
        })
    }

    public async setSearch (value: string): Promise<void> {
        await this.searchInput.setValue(value)
        await driver.hideKeyboard().catch(() => undefined)
    }

    public async getSearchValue (): Promise<string> {
        const value = await this.searchInput.getAttribute('text')
        return value === 'Search' ? '' : (value ?? '')
    }

    public async setPriceRange (min: number, max: number): Promise<void> {
        await this.priceMinInput.setValue(String(min))
        await this.priceMaxInput.setValue(String(max))
        await driver.hideKeyboard().catch(() => undefined)
    }

    public async setKilometerRange (min: number, max: number): Promise<void> {
        await this.kmMinInput.setValue(String(min))
        await this.kmMaxInput.setValue(String(max))
        await driver.hideKeyboard().catch(() => undefined)
    }

    public async selectYear (bound: RangeBound, year: number): Promise<void> {
        const selector = `android=new UiSelector().description("${bound}")`
        const yearBound = $(selector)
        await yearBound.waitForDisplayed()
        await yearBound.click()
        const yearOption = $(`android=new UiSelector().text("${year}")`)
        await yearOption.waitForDisplayed()
        await yearOption.click()
    }

    public async setVatRefundable (enabled: boolean): Promise<void> {
        const current = (await this.vatRefundableSwitch.getAttribute('checked')) === 'true'
        if (current !== enabled) await this.vatRefundableSwitch.click()
    }

    public async isVatRefundableEnabled (): Promise<boolean> {
        return (await this.vatRefundableSwitch.getAttribute('checked')) === 'true'
    }

    public async clearAll (): Promise<void> {
        if (await this.isChoiceSheetDisplayed()) await this.closeChoiceSheet()
        await this.clearAllButton.click()
    }

    public async resetToDefaults (): Promise<void> {
        await this.clearAll()
        try {
            await this.selectCondition('Used')
        } catch {}
        try {
            await this.selectVehicleCategory('Car')
        } catch {}
    }

    public async apply (): Promise<void> {
        // Close any open choice sheet before clicking Apply
        if (await this.isChoiceSheetDisplayed()) {
            await this.closeChoiceSheet().catch(() => undefined)
            await browser.pause(300)
        }
        await this.applyButton.click()
        await browser.waitUntil(async () => {
            // Success if filter screen is gone OR listings screen is detected
            if (!await this.isDisplayed()) return true
            if (await listingsPage.isDisplayed()) return true
            return false
        }, {
            timeout: 25000,
            interval: 300,
            timeoutMsg: 'Applying the filters did not return to listings.'
        })
    }

    public async openFromResults (): Promise<void> {
        // Ensure we're on the listings screen before trying to open filter
        await browser.waitUntil(async () => await listingsPage.isDisplayed(), {
            timeout: 15000,
            interval: 300,
            timeoutMsg: 'Expected to be on the listings screen before opening Filter from results.'
        }).catch(() => undefined)
        await listingsPage.scrollToTop().catch(() => undefined)
        await browser.pause(400)
        if (!await this.isDisplayed()) await listingsPage.openFilter()
        await this.waitForScreen()
    }

    public async assertLowerControlsVisible (): Promise<void> {
        const bodyType = $('android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("Body type"))')
        await bodyType.waitForDisplayed()
        await $('android=new UiSelector().text("Fuel")').waitForDisplayed()
    }

    public async scrollVehicleCategoriesToBike (): Promise<void> {
        const source = await driver.getPageSource()
        const rootBounds = source.match(/bounds="\[0,0\]\[(\d+),(\d+)\]"/)
        if (!rootBounds) throw new Error('Could not read the Filter screen dimensions to scroll vehicle categories.')
        const width = Number(rootBounds[1])
        await browser.execute('mobile: scrollGesture', {
            left: Math.round(width * 0.04),
            top: 470,
            width: Math.round(width * 0.92),
            height: 140,
            direction: 'right',
            percent: 0.6
        })
        await $('~Bike').waitForDisplayed()
    }
}

export default new FilterPage()
