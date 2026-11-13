import { browser, driver } from '@wdio/globals'
import { appData } from '../data/app.data.js'
import { hasValidLoginCredentials, loginData } from '../data/login.data.js'
import filterPage from '../pageobjects/filter.page.js'
import homePage from '../pageobjects/home.page.js'
import listingsPage from '../pageobjects/listings.page.js'
import loginPage from '../pageobjects/login.page.js'
import profilePage from '../pageobjects/profile.page.js'
import welcomePage from '../pageobjects/welcome.page.js'
import { markCurrentRecordingAsCredentialSensitive } from './allure-artifacts.js'

export type CartoBikeModule = 'login' | 'onboarding' | 'home' | 'listings' | 'filter' | 'profile'

type AppScreen = 'login' | 'onboarding' | 'home' | 'listings' | 'filter' | 'profile' | 'authenticated' | 'unknown'

const SAFE_LABELS = [
    'Sign in', 'Welcome back!', 'E-mail', 'Password', 'Log In', 'Forgot password?',
    'Sign in with Google', 'Sign up here', 'Continue', 'Home', 'Message', 'Sell',
    'Auctions', 'Profile', 'Account', 'Filter', 'Find Perfect Vehicle',
    'New cars', 'Used cars', 'New motorcycles', 'Used motorcycles', 'Cars'
]

/** Navigate the active CartoBike app session to a supported test module. */
export async function navigateToModule (target: CartoBikeModule): Promise<void> {
    await driver.activateApp(appData.packageName)
    await waitForKnownScreen()

    let screen = await detectScreen()
    if (target === 'login') {
        if (screen === 'login') {
            await loginPage.waitForScreen()
            return
        }
        if (screen === 'onboarding') {
            await welcomePage.continueToLogin()
            await waitForScreen(['login'])
            await loginPage.waitForScreen()
            return
        }
        if (screen === 'profile' || screen === 'authenticated' || screen === 'home' || screen === 'listings' || screen === 'filter') {
            throw new Error('CartoBike is already authenticated. The module navigator does not log out automatically to reach Login.')
        }
        throw await navigationError(target)
    }

    if (target === 'onboarding') {
        if (screen === 'onboarding') return
        throw new Error('CartoBike onboarding is not currently available. The navigator will not clear app data to replay first-launch onboarding.')
    }

    screen = await ensureAuthenticated(screen)
    if (target === 'home') {
        await navigateHome(screen)
        return
    }
    if (target === 'listings') {
        await navigateHome(screen)
        await homePage.openDefaultVehicleListings()
        await waitForScreen(['listings'])
        return
    }
    if (target === 'filter') {
        if (screen === 'filter') {
            await filterPage.waitForScreen()
            return
        }
        if (screen !== 'listings') {
            await navigateHome(screen)
            await homePage.openDefaultVehicleListings()
            await waitForScreen(['listings'])
        }
        await listingsPage.openFilter()
        await filterPage.waitForScreen()
        return
    }
    if (target === 'profile') {
        if (screen === 'profile') return
        await navigateHome(screen)
        await homePage.openProfile()
        await browser.waitUntil(async () => await profilePage.isDisplayed(), {
            timeout: 15000,
            interval: 300,
            timeoutMsg: 'Profile navigation did not open the CartoBike Profile screen.'
        })
        return
    }

    throw new Error(`Unsupported CartoBike module: ${target}`)
}

async function ensureAuthenticated (screen: AppScreen): Promise<AppScreen> {
    if (isAuthenticated(screen)) return screen

    if (screen === 'onboarding') {
        await welcomePage.continueToLogin()
        await waitForScreen(['login', 'home', 'profile', 'authenticated'])
        screen = await detectScreen()
        if (isAuthenticated(screen)) return screen
    }

    if (screen !== 'login') throw await navigationError('home')
    if (!hasValidLoginCredentials) {
        throw new Error('CartoBike is on Login and the requested module requires authentication. Configure CARTOBIKE_LOGIN_EMAIL and CARTOBIKE_LOGIN_PASSWORD in .env or the process environment.')
    }

    await loginPage.waitForScreen()
    const redactionRects = await loginPage.credentialFieldRects()
    await markCurrentRecordingAsCredentialSensitive(redactionRects)
    await loginPage.emailInput.setValue(loginData.email!)
    await loginPage.passwordInput.setValue(loginData.password!)
    await driver.hideKeyboard().catch(() => undefined)
    await loginPage.submit()
    await browser.waitUntil(async () => {
        const current = await detectScreen()
        return isAuthenticated(current)
    }, {
        timeout: 30000,
        interval: 500,
        timeoutMsg: 'CartoBike login did not reach an authenticated screen. Check the configured QA account and network availability.'
    })
    return detectScreen()
}

function isAuthenticated (screen: AppScreen): boolean {
    return ['home', 'listings', 'filter', 'profile', 'authenticated'].includes(screen)
}

async function navigateHome (screen: AppScreen): Promise<void> {
    if (screen === 'home') {
        await browser.waitUntil(async () => await homePage.isVehicleSearchFormDisplayed(), {
            timeout: 15000,
            interval: 300,
            timeoutMsg: 'CartoBike Home opened, but its vehicle search form was not available.'
        })
        return
    }
    if (!await homePage.isHomeTabAvailable()) {
        throw new Error(`Cannot navigate to CartoBike Home from the current ${screen} screen because the Home tab is not available.`)
    }
    await homePage.openVehicleSearchHome()
}

async function detectScreen (): Promise<AppScreen> {
    if (await loginPage.isDisplayed()) return 'login'
    if (await welcomePage.isContinueVisible()) return 'onboarding'
    if (await filterPage.isDisplayed()) return 'filter'
    if (await listingsPage.isDisplayed()) return 'listings'
    if (await homePage.isVehicleSearchFormDisplayed()) return 'home'
    if (await profilePage.isDisplayed()) return 'profile'
    if (await homePage.isAuthenticatedAreaDisplayed()) return 'authenticated'
    return 'unknown'
}

async function waitForKnownScreen (): Promise<void> {
    await browser.waitUntil(async () => {
        await welcomePage.dismissKnownStartupPopup()
        return (await detectScreen()) !== 'unknown'
    }, {
        timeout: 30000,
        interval: 500,
        timeoutMsg: 'CartoBike did not reach a recognized screen after launch.'
    }).catch(async error => {
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`${reason} ${await safeScreenSummary()}`)
    })
}

async function waitForScreen (expected: AppScreen[]): Promise<void> {
    await browser.waitUntil(async () => expected.includes(await detectScreen()), {
        timeout: 30000,
        interval: 500,
        timeoutMsg: `CartoBike did not reach the expected ${expected.join(' or ')} screen.`
    })
}

async function navigationError (target: CartoBikeModule): Promise<Error> {
    return new Error(`Cannot navigate to CartoBike ${target} from the current screen. ${await safeScreenSummary()}`)
}

async function safeScreenSummary (): Promise<string> {
    const packageName = await driver.getCurrentPackage().catch(() => 'unavailable')
    const source = await driver.getPageSource().catch(() => '')
    const labels = SAFE_LABELS.filter(label =>
        source.includes(`text="${label}"`) || source.includes(`content-desc="${label}"`))
    return `Current package: ${packageName}. Recognized labels: ${labels.join(', ') || 'none'}.`
}
