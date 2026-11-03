import { driver } from '@wdio/globals'
import { addDescription, step } from '@wdio/allure-reporter'
import { randomUUID } from 'node:crypto'
import { hasNegativeLoginAccount, hasValidLoginCredentials, loginData } from '../data/login.data.js'
import loginPage from '../pageobjects/login.page.js'
import { prepareLoggedOutLoginState } from '../support/login-test-setup.js'

describe('Login', () => {
    beforeEach(async function (this: Mocha.Context) {
        const title = this.currentTest?.title ?? ''
        if (title === 'logs in with the configured QA credentials and leaves the login screen' && !hasValidLoginCredentials) {
            const reason = 'Set CARTOBIKE_LOGIN_EMAIL and CARTOBIKE_LOGIN_PASSWORD in the existing .env to run this test.'
            await addDescription(`Prerequisite not met: ${reason}`)
            await step('Check successful-login QA credential configuration', async () => undefined)
            this.skip()
        }
        if (title === 'rejects an incorrect password for a dedicated QA account' && !hasNegativeLoginAccount) {
            const reason = 'Set CARTOBIKE_NEGATIVE_LOGIN_EMAIL in .env to a separate lockout-safe QA account to run this test.'
            await addDescription(`Prerequisite not met: ${reason}`)
            await step('Check lockout-safe negative-test account configuration', async () => undefined)
            this.skip()
        }
        await prepareLoggedOutLoginState()
    })

    it('shows the login fields, labels, placeholders, and available actions', async () => {
        await addDescription('Verify the Login screen exposes its expected labels, editable fields, and sign-in actions.')
        await step('Verify the Login heading and field labels', async () => {
            expect(await loginPage.signInTitle.isDisplayed()).toBe(true)
            expect(await loginPage.welcomeText.isDisplayed()).toBe(true)
            expect(await loginPage.emailLabel.isDisplayed()).toBe(true)
            expect(await loginPage.passwordLabel.isDisplayed()).toBe(true)
        })
        await step('Verify the email and password fields are editable and correctly configured', async () => {
            expect(await loginPage.emailInput.isDisplayed()).toBe(true)
            expect(await loginPage.emailInput.isEnabled()).toBe(true)
            expect(await loginPage.emailInput.getAttribute('hint')).toBe('xx@domain.com')
            expect(await loginPage.passwordInput.isDisplayed()).toBe(true)
            expect(await loginPage.passwordInput.isEnabled()).toBe(true)
            expect(await loginPage.passwordInput.getAttribute('hint')).toBe('Password')
            expect(await loginPage.passwordInput.getAttribute('password')).toBe('true')
        })
        await step('Verify Login, Forgot password, and Google sign-in actions are available', async () => {
            for (const control of [loginPage.loginButton, loginPage.forgotPasswordLink, loginPage.googleSignInButton]) {
                expect(await control.isDisplayed()).toBe(true)
                expect(await control.isEnabled()).toBe(true)
            }
        })
    })

    it('shows required-field validation when both fields are empty', async () => {
        await addDescription('Submit the Login form with both fields empty and verify required-field validation.')
        await step('Submit Login without entering either credential', async () => loginPage.submit())
        await step('Verify required-field messages and remain on Login', async () => {
            expect(await loginPage.requiredMessageCount()).toBeGreaterThan(0)
            expect(await loginPage.isDisplayed()).toBe(true)
        })
    })

    it('shows an email-format validation message for an invalid email', async () => {
        await addDescription('Enter an invalid email address, submit Login, and verify the email-format message.')
        await step('Enter an invalid email address', async () => loginPage.emailInput.setValue(loginData.invalidEmail))
        await step('Submit Login with the invalid email', async () => loginPage.submit())
        await step('Verify the email-format validation message appears', async () => {
            await loginPage.invalidEmailMessage.waitForDisplayed()
            expect(await loginPage.invalidEmailMessage.isDisplayed()).toBe(true)
        })
    })

    it('requires a password when only the email field is populated', async () => {
        await addDescription('Enter an email without a password and verify password-required validation.')
        await step('Enter an email address while leaving Password empty', async () => loginPage.emailInput.setValue(loginData.testEmail))
        await step('Submit Login with the password omitted', async () => loginPage.submit())
        await step('Verify the required-field message is shown for Password', async () => {
            expect(await loginPage.requiredMessageCount()).toBe(1)
        })
    })

    it('allows users to enter and edit email text while the keyboard is available', async () => {
        await addDescription('Focus the email field, verify the keyboard opens, and replace the entered text.')
        await step('Focus the email field and verify the keyboard is displayed', async () => {
            await loginPage.emailInput.click()
            expect(await driver.isKeyboardShown()).toBe(true)
        })
        await step('Enter and replace the email text', async () => {
            await loginPage.emailInput.setValue(loginData.firstEditedEmail)
            await loginPage.emailInput.setValue(loginData.secondEditedEmail)
        })
        await step('Verify the replacement email text is present', async () => {
            expect(await loginPage.emailInput.getAttribute('text')).toBe(loginData.secondEditedEmail)
        })
    })

    it('logs in with the configured QA credentials and leaves the login screen', async () => {
        await addDescription('Enter configured QA credentials, submit Login, and verify the authenticated screen replaces Login.')
        await step('Enter configured QA credentials', async () => {
            await loginPage.emailInput.setValue(loginData.email!)
            await loginPage.passwordInput.setValue(loginData.password!)
        })
        await step('Submit the Login form', async () => loginPage.submit())
        await step('Verify the Login fields disappear after successful authentication', async () => {
            await loginPage.emailInput.waitForDisplayed({ reverse: true })
            expect(await loginPage.isDisplayed()).toBe(false)
        })
    })

    it('rejects an incorrect password for a dedicated QA account', async () => {
        await addDescription('Submit a runtime-generated incorrect password for the separately configured lockout-safe QA account and verify Login remains displayed.')
        await step('Enter the lockout-safe QA account and a generated incorrect password', async () => {
            await loginPage.emailInput.setValue(loginData.negativeEmail!)
            await loginPage.passwordInput.setValue(`invalid-${randomUUID()}`)
        })
        await step('Submit the incorrect password once', async () => loginPage.submit())
        await step('Verify authentication was rejected and the Login screen remains displayed', async () => {
            await loginPage.loginButton.waitForDisplayed()
            expect(await loginPage.isDisplayed()).toBe(true)
        })
    })
})
