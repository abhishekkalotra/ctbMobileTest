import BasePage from './base.page.js'
import { $, browser, driver } from '@wdio/globals'

const logoutSelectors = [
    '~Log out',
    '~Logout',
    '~Sign out',
    'android=new UiSelector().textMatches("(?i)^(log ?out|sign ?out)$")',
    'android=new UiSelector().descriptionMatches("(?i)^(log ?out|sign ?out)$")'
]

const confirmationSelectors = [
    '~Confirm',
    '~Yes',
    'android=new UiSelector().textMatches("(?i)^(confirm|yes|log ?out|sign ?out)$")',
    'android=new UiSelector().descriptionMatches("(?i)^(confirm|yes|log ?out|sign ?out)$")'
]

/** Profile/account screen actions, including logout and its optional confirmation. */
class ProfilePage extends BasePage {
    public async isDisplayed (): Promise<boolean> {
        const source = await driver.getPageSource()
        return /(?:text|content-desc)="(?:my profile|profile|my account|account)"/i.test(source)
    }

    public async hasLogoutButton (): Promise<boolean> {
        return Boolean(await this.findVisible(logoutSelectors))
    }

    private async findVisible (selectors: string[]): Promise<WebdriverIO.Element | null> {
        for (const selector of selectors) {
            const element = $(selector)
            if (await element.isDisplayed().catch(() => false)) return element
        }
        return null
    }

    public async isLogoutConfirmationDisplayed (): Promise<boolean> {
        const source = await driver.getPageSource()
        return /(?:text|content-desc)="[^"]*(?:are you sure|confirm)[^"]*"/i.test(source) ||
            /(?:text|content-desc)="[^"]*(?:log ?out|sign ?out)[^"]*\?[^\"]*"/i.test(source)
    }

    private async openAccountSwitcher (): Promise<void> {
        // The observed profile card exposes an unlabeled chevron at its right edge.
        const { width, height } = await browser.getWindowSize()
        await browser.execute('mobile: clickGesture', {
            x: Math.round(width * 0.9),
            y: Math.round(height * 0.128)
        })
    }

    public async logout (): Promise<void> {
        if (!await this.hasLogoutButton()) {
            await this.openAccountSwitcher()
            await browser.waitUntil(async () => await this.hasLogoutButton(), {
                timeout: 10000,
                interval: 300,
                timeoutMsg: 'Account switcher did not display a Sign out control.'
            })
        }

        const logoutButton = await this.findVisible(logoutSelectors)
        if (!logoutButton) throw new Error('Profile/Account screen is open, but no Logout control was found.')
        await logoutButton.click()

        // Confirmation is optional and may appear after the logout action.
        await browser.waitUntil(async () => {
            if (await this.isLogoutConfirmationDisplayed()) return true
            return this.findVisible(confirmationSelectors).then(Boolean)
        }, { timeout: 2500, timeoutMsg: 'Logout confirmation state check timed out.' }).catch(() => undefined)

        if (await this.isLogoutConfirmationDisplayed()) {
            const confirmButton = await this.findVisible(confirmationSelectors)
            if (!confirmButton) throw new Error('A logout confirmation appeared, but its confirmation button was not found.')
            await confirmButton.click()
        }
    }
}

export default new ProfilePage()
