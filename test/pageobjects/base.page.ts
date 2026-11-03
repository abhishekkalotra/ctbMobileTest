import { driver } from '@wdio/globals'

/** Shared app-level operations used by page objects. */
export default class BasePage {
    public async launchApp (packageName: string): Promise<void> {
        await driver.activateApp(packageName)
    }

    public async getCurrentPackage (): Promise<string> {
        return driver.getCurrentPackage()
    }
}
