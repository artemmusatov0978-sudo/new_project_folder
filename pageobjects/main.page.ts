import { isChecked, pause, scrollToText, waitForElement, waitForElementAndClick, waitForElementAndSetValue } from "../helpers/global.methods";


type Gender = 'male' | 'female';

const APP_ID = 'com.androidsample.generalstore';

class MainPage {

    get toolbarTitle(): Promise<WebdriverIO.Element> {
        return $(`android=new UiSelector().resourceId("${APP_ID}:id/toolbar_title")`);
    }

    get mainImage(): Promise<WebdriverIO.Element> {
        return $('android=new UiSelector().className("android.widget.ImageView")');
    }

    get countryDropdown(): Promise<WebdriverIO.Element> {
        return $('android=new UiSelector().resourceId("android:id/text1")');
    }

    get radioMale(): Promise<WebdriverIO.Element> {
        return $(`android=new UiSelector().resourceId("${APP_ID}:id/radioMale")`);
    }

    get radioFemale(): Promise<WebdriverIO.Element> {
        return $(`android=new UiSelector().resourceId("${APP_ID}:id/radioFemale")`);
    }

    get nameField(): Promise<WebdriverIO.Element> {
        return $(`android=new UiSelector().resourceId("${APP_ID}:id/nameField")`);
    }

    get letsShopButton(): Promise<WebdriverIO.Element> {
        return $(`android=new UiSelector().resourceId("${APP_ID}:id/btnLetsShop")`);
    }



    async waitForPage(timeout: number = 15000): Promise<void> {
        await (await this.toolbarTitle).waitForDisplayed({ timeout });
    }

    async selectCountry(countryName: string): Promise<void> {
        await waitForElement('android=new UiSelector().resourceId("android:id/text1")');
        await (await this.countryDropdown).click();
        const option = await scrollToText(countryName);
        await option.click();
    }

    async selectGender(gender: Gender = 'male'): Promise<void> {
        const el = gender === 'male' ? await this.radioMale : await this.radioFemale;
        await el.waitForDisplayed({ timeout: 15000 });
        await el.click();
        await pause(500);
    }

    async isMaleChecked(): Promise<boolean> {
        return isChecked(`android=new UiSelector().resourceId("${APP_ID}:id/radioMale")`);
    }

    async isFemaleChecked(): Promise<boolean> {
        return isChecked(`android=new UiSelector().resourceId("${APP_ID}:id/radioFemale")`);
    }

    async enterName(name: string): Promise<void> {
        await waitForElementAndSetValue(
            `android=new UiSelector().resourceId("${APP_ID}:id/nameField")`,
            name
        );
    }

    async tapLetsShop(): Promise<void> {
        await waitForElementAndClick(
            `android=new UiSelector().resourceId("${APP_ID}:id/btnLetsShop")`
        );
    }
}

export default new MainPage();