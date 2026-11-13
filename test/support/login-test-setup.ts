import { step } from '@wdio/allure-reporter'
import { browser, driver } from '@wdio/globals'
import { appData } from '../data/app.data.js'
import homePage from '../pageobjects/home.page.js'
import loginPage from '../pageobjects/login.page.js'
import profilePage from '../pageobjects/profile.page.js'
import welcomePage from '../pageobjects/welcome.page.js'

type AppState = 'login' | 'onboarding' | 'authenticated' | 'unknown'

const SAFE_SCREEN_LABELS = [
    'Sign in', 'Welcome back!', 'E-mail', 'Password', 'Log In', 'Forgot password?',
    'Sign in with Google', 'Sign up here', 'Continue', 'Home', 'Message', 'Sell',
    'Auctions', 'Profile', 'Account', 'Not now', 'Later', 'Skip', 'Close', 'Dismiss',
    'Allow', "Don't allow", 'OK', 'Cancel', 'Retry'
]

/** Summarize only known static labels and element classes; never log arbitrary field text. */
async function getSafeStartupDiagnostics (): Promise<string> {
    const packageName = await driver.getCurrentPackage().catch(() => 'unavailable')
    const source = await driver.getPageSource().catch(() => '')
    const labels = SAFE_SCREEN_LABELS.filter(label =>
        source.includes(`text="${label}"`) || source.includes(`content-desc="${label}"`))
    const classes = new Map<string, number>()
    for (const match of source.matchAll(/class="([^"]+)"/g)) {
        const name = match[1]
        if (!name) continue
        classes.set(name, (classes.get(name) ?? 0) + 1)
    }
    const classSummary = [...classes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => `${name}×${count}`)
        .join(', ') || 'unavailable'

    return `Current package: ${packageName}. Recognized UI labels: ${labels.join(', ') || 'none'}. Element classes: ${classSummary}.`
}

async function detectState (): Promise<AppState> {
    if (await loginPage.isDisplayed()) return 'login'
    if (await welcomePage.isContinueVisible()) return 'onboarding'
    if (await profilePage.hasLogoutButton() || await homePage.isAuthenticatedAreaDisplayed()) return 'authenticated'
    return 'unknown'
}

/** Prepare a clean logged-out state before each login test. */
export async function prepareLoggedOutLoginState (): Promise<void> {
    await step('Launch CartoBike application', async () => {
        await welcomePage.launchApp(appData.packageName)
    })

    await step('Wait for a recognized app screen and dismiss known startup overlays', async () => {
        try {
            await browser.waitUntil(async () => {
                await welcomePage.dismissKnownStartupPopup()
                return (await detectState()) !== 'unknown'
            }, {
                timeout: 30000,
                interval: 500,
                timeoutMsg: 'CartoBike did not reach Login, onboarding, or an authenticated screen within 30 seconds.'
            })
        } catch (error) {
            const diagnostics = await getSafeStartupDiagnostics()
            const reason = error instanceof Error ? error.message : String(error)
            throw new Error(`${reason} ${diagnostics}`)
        }
    })

    let state = await detectState()
    if (state === 'onboarding') {
        await step('Complete onboarding and continue to Login', async () => {
            await welcomePage.continueToLogin()
            await browser.waitUntil(async () => (await detectState()) !== 'unknown' && (await detectState()) !== 'onboarding', {
                timeout: 30000,
                interval: 500,
                timeoutMsg: 'Onboarding did not advance to Login or an authenticated screen.'
            })
        })
        state = await detectState()
    }

    await step(`Detect current authentication state: ${state}`, async () => {
        if (state === 'unknown') {
            // Do not include page source because it can contain entered credentials.
            const source = await driver.getPageSource()
            throw new Error(`Unable to determine the CartoBike authentication state. Screen hierarchy length: ${source.length}.`)
        }
    })
    if (state === 'authenticated') {
        await step('Open Profile or Account', async () => {
            if (!await profilePage.isDisplayed()) await homePage.openProfile()
            await browser.waitUntil(async () => await profilePage.isDisplayed(), {
                timeout: 15000,
                interval: 300,
                timeoutMsg: 'The Profile/Account screen did not open.'
            })
        })

        await step('Open account switcher if needed, sign out, and handle an optional confirmation', async () => {
            await profilePage.logout()
            await browser.waitUntil(async () => await loginPage.isDisplayed(), {
                timeout: 30000,
                interval: 500,
                timeoutMsg: 'Logout did not return the app to the Login screen.'
            })
        })
    } else {
        await step('Skip logout because the app is already logged out', async () => undefined)
    }

    await step('Verify Login screen is displayed and ready', async () => {
        await loginPage.waitForScreen()
        if (!await loginPage.isDisplayed()) throw new Error('CartoBike is not on the Login screen after authentication setup.')
        await loginPage.clearForm()
    })
}
