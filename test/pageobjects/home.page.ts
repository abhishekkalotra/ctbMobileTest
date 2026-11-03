import BasePage from './base.page.js'
import { $, browser, driver } from '@wdio/globals'

const profileSelectors = [
    '~Profile',
    '~Account',
    'android=new UiSelector().textMatches("(?i)^(profile|account|my account)$")',
    'android=new UiSelector().descriptionMatches("(?i)^(profile|account|my account)$")'
]

/** Navigation and state checks for the authenticated part of the app. */
class HomePage extends BasePage {
    public async findProfileNavigation (): Promise<WebdriverIO.Element | null> {
        for (const selector of profileSelectors) {
            const element = $(selector)
            if (await element.isDisplayed().catch(() => false)) return element
        }
        return null
    }

    public async isAuthenticatedAreaDisplayed (): Promise<boolean> {
        if (await this.findProfileNavigation()) return true
        const source = await driver.getPageSource()
        if (/(?:text|content-desc)="(?:log ?out|sign ?out|my account)"/i.test(source)) return true
        // The observed CartoBike bottom navigation has no accessible label on its
        // Profile avatar, but the other authenticated tabs are labeled.
        return ['Home', 'Message', 'Sell', 'Auctions'].every(label =>
            new RegExp(`(?:text|content-desc)="${label}"`, 'i').test(source))
    }

    public async openProfile (): Promise<void> {
        const profileNavigation = await this.findProfileNavigation()
        if (profileNavigation) {
            await profileNavigation.click()
            return
        }

        // On the observed Android build, Profile is the unlabeled avatar at the
        // far right of the bottom tab bar.
        const { width, height } = await browser.getWindowSize()
        await browser.execute('mobile: clickGesture', {
            x: Math.round(width * 0.9),
            y: Math.round(height * 0.945)
        })
    }
}

export default new HomePage()
