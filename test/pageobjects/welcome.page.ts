import BasePage from './base.page.js'
import { $, driver } from '@wdio/globals'

/** Operations for the launch state verified by the current test suite. */
class WelcomePage extends BasePage {
    public get continueButton () {
        return $('android=new UiSelector().text("Continue")')
    }

    public async isContinueVisible (): Promise<boolean> {
        const source = await driver.getPageSource()
        return source.includes('text="Continue"') || source.includes('content-desc="Continue"')
    }

    public async continueToLogin (): Promise<void> {
        await this.continueButton.waitForDisplayed()
        await this.continueButton.click()
    }

    /** Dismiss only familiar, nonessential overlays; unknown dialogs are left for diagnostics. */
    public async dismissKnownStartupPopup (): Promise<boolean> {
        const safeDismissLabels = ['Not now', 'Later', 'Skip', 'Close', 'Dismiss', "Don't allow"]
        for (const label of safeDismissLabels) {
            const control = $(`android=new UiSelector().text("${label}")`)
            if (await control.isDisplayed().catch(() => false)) {
                await control.click()
                return true
            }
        }
        return false
    }
}

export default new WelcomePage()
