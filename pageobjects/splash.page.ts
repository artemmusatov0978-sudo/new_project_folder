import { waitForElement } from "../helpers/global.methods";

 
const SELECTORS = {
    splashScreen: 'android=new UiSelector().resourceId("com.androidsample.generalstore:id/splashscreen")',
} as const;
 
class SplashPage {
    get splashScreen(): Promise<WebdriverIO.Element> {
        return $(SELECTORS.splashScreen);
    }
 
    async waitForSplash(timeout: number = 15000): Promise<void> {
        await waitForElement(SELECTORS.splashScreen, timeout);
    }
}
 
export default new SplashPage();