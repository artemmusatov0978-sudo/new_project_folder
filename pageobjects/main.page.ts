import GM from "../helpers/global.methods";

type Gender = 'male' | 'female';

const APP_ID = 'com.androidsample.generalstore';

const SELECTORS = {
    toolbarTitle: `android=new UiSelector().resourceId("${APP_ID}:id/toolbar_title")`,
    mainImage: 'android=new UiSelector().className("android.widget.ImageView")',
    countryDropdown: 'android=new UiSelector().resourceId("android:id/text1")',
    radioMale: `android=new UiSelector().resourceId("${APP_ID}:id/radioMale")`,
    radioFemale: `android=new UiSelector().resourceId("${APP_ID}:id/radioFemale")`,
    nameField: `android=new UiSelector().resourceId("${APP_ID}:id/nameField")`,
    letsShopButton: `android=new UiSelector().resourceId("${APP_ID}:id/btnLetsShop")`

} as const;

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
        await GM.waitForElement(SELECTORS.countryDropdown);
        await (await this.countryDropdown).click();
        const option = await GM.scrollToText(countryName);
        await option.click();
    }

    async selectGender(gender: Gender = 'male'): Promise<void> {
        const el = gender === 'male' ? await this.radioMale : await this.radioFemale;
        await el.waitForDisplayed({ timeout: 15000 });
        await el.click();
        await GM.pause(500);
    }

    async isMaleChecked(): Promise<boolean> {
        return GM.isChecked(SELECTORS.radioMale);
    }

    async isFemaleChecked(): Promise<boolean> {
        return GM.isChecked(SELECTORS.radioFemale);
    }

    async enterName(name: string): Promise<void> {
        await GM.waitForElementAndSetValue(
            SELECTORS.nameField,
            name
        );
    }

 async checkName(name: string): Promise<void> {
    const NameText = await GM.waitForElementAndGetText(SELECTORS.nameField,
    );
    await expect(NameText).toHaveText(name)
    }

    async tapLetsShop(): Promise<void> {
        await GM.waitForElementAndClick(
            SELECTORS.letsShopButton
        );
    }
}

export default new MainPage();
