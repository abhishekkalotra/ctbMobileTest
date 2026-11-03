import BasePage from './base.page.js'
import { $, $$ } from '@wdio/globals'

/** Login controls observed in the CartoBike Android accessibility hierarchy. */
class LoginPage extends BasePage {
    public get emailInput () {
        return $('android=new UiSelector().className("android.widget.EditText").instance(0)')
    }

    public get passwordInput () {
        return $('android=new UiSelector().className("android.widget.EditText").instance(1)')
    }

    public get signInTitle () { return $('android=new UiSelector().text("Sign in")') }
    public get welcomeText () { return $('android=new UiSelector().text("Welcome back!")') }
    public get emailLabel () { return $('android=new UiSelector().text("E-mail")') }
    public get passwordLabel () { return $('android=new UiSelector().text("Password").instance(0)') }
    public get loginButton () { return $('~Log In') }
    public get forgotPasswordLink () { return $('~Forgot password?') }
    public get googleSignInButton () { return $('~Sign in with Google') }
    public get signUpLink () { return $('~Sign up here') }
    public get requiredValidationMessages () { return $$('android=new UiSelector().text("This field is required")') }
    public get invalidEmailMessage () { return $('android=new UiSelector().text("Please enter valid email address")') }

    public async waitForScreen (): Promise<void> {
        await this.signInTitle.waitForDisplayed()
        await this.emailInput.waitForDisplayed()
    }

    public async isDisplayed (): Promise<boolean> {
        return (await this.signInTitle.isDisplayed().catch(() => false)) &&
            (await this.emailInput.isDisplayed().catch(() => false))
    }

    public async clearForm (): Promise<void> {
        await this.emailInput.clearValue()
        await this.passwordInput.clearValue()
    }

    /** Return credential field bounds for masking them in failure recordings. */
    public async credentialFieldRects () {
        const [emailLocation, emailSize, passwordLocation, passwordSize] = await Promise.all([
            this.emailInput.getLocation(), this.emailInput.getSize(),
            this.passwordInput.getLocation(), this.passwordInput.getSize()
        ])
        return [
            { ...emailLocation, ...emailSize },
            { ...passwordLocation, ...passwordSize }
        ]
    }

    public async submit (): Promise<void> {
        await this.loginButton.click()
    }

    public async requiredMessageCount (): Promise<number> {
        const messages = await this.requiredValidationMessages
        let visibleCount = 0
        for (const message of messages) {
            if (await message.isDisplayed()) visibleCount += 1
        }
        return visibleCount
    }
}

export default new LoginPage()
