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
    private toolbarTitleSelector: string;
    private mainImageSelector: string;
    private countryDropdownSelector: string;
    private radioMaleSelector: string;
    private radioFemaleSelector: string;
    private nameFieldSelector: string;
    private letsShopButtonSelector: string;

      constructor() {
        this.toolbarTitleSelector = SELECTORS.toolbarTitle;
        this.mainImageSelector = SELECTORS.mainImage;
        this.countryDropdownSelector = SELECTORS.countryDropdown;
        this.radioMaleSelector = SELECTORS.radioMale;
        this.radioFemaleSelector = SELECTORS.radioFemale;
        this.nameFieldSelector = SELECTORS.nameField;
        this.letsShopButtonSelector = SELECTORS.letsShopButton;
    }

    get toolbarTitle(): Promise<WebdriverIO.Element> {
        return $(this.toolbarTitleSelector);
    }

        mainImage(): Promise<WebdriverIO.Element> {
        return $(this.mainImageSelector);
    }
    get countryDropdown(): Promise<WebdriverIO.Element> {
        return $(this.countryDropdownSelector);
    }
    get radioMale(): Promise<WebdriverIO.Element> {
        return $(this.radioMaleSelector);
    }
    get radioFemale(): Promise<WebdriverIO.Element> {
        return $(this.radioFemaleSelector);
    }
        nameField(): Promise<WebdriverIO.Element> {
        return $(this.nameFieldSelector);
    }
        letsShopButton(): Promise<WebdriverIO.Element> {
        return $(this.letsShopButtonSelector);
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
        console.log(name)
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
