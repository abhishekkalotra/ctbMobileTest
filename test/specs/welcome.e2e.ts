import welcomePage from '../pageobjects/welcome.page.js'
import loginPage from '../pageobjects/login.page.js'
import { appData } from '../data/app.data.js'
import { addDescription, step } from '@wdio/allure-reporter'

describe('Welcome', () => {
    it('handles first launch and subsequent launches without repeating onboarding', async () => {
        await addDescription('Verify onboarding can be completed on first launch and is not repeated on a subsequent launch.')
        await step('Launch CartoBike and check whether onboarding is displayed', async () => {
            await welcomePage.launchApp(appData.packageName)
        })
        const onboardingIsShown = await welcomePage.isContinueVisible()

        if (onboardingIsShown) {
            await step('Verify Continue is available and complete onboarding', async () => {
                expect(onboardingIsShown).toBe(true)
                expect(await welcomePage.continueButton.isEnabled()).toBe(true)
                await welcomePage.continueToLogin()
            })
        }

        await step('Verify onboarding advances to the Login screen', async () => {
            await loginPage.waitForScreen()
            expect(await loginPage.isDisplayed()).toBe(true)
            expect(await welcomePage.isContinueVisible()).toBe(false)
        })

        await step('Relaunch CartoBike and verify onboarding is not shown again', async () => {
            await welcomePage.launchApp(appData.packageName)
            await loginPage.waitForScreen()
            expect(await welcomePage.isContinueVisible()).toBe(false)
        })
    })
})
