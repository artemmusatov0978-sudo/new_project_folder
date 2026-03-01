import GM from "../helpers/global.methods";

// const SELECTORS = {
//     splashScreen: 'android=new UiSelector().resourceId("com.androidsample.generalstore:id/splashscreen")',
// } as const;
 
// class SplashPage {
//     get splashScreen(): Promise<WebdriverIO.Element> {
//         return $(SELECTORS.splashScreen);
//     }
 
//     async waitForSplash(timeout: number = 15000): Promise<void> {
//         await GM.waitForElement(SELECTORS.splashScreen, timeout);
//     }
// }
 
// export default new SplashPage();

const SELECTORS = {
    splashScreen: 'android=new UiSelector().resourceId("com.androidsample.generalstore:id/splashscreen")',
} as const;
 
class SplashPage {
    private splashScreenSelector: string;
 
    constructor() {
        this.splashScreenSelector = SELECTORS.splashScreen;
    }
 
    splashScreen(): Promise<WebdriverIO.Element> {
        return $(this.splashScreenSelector);
    }
 
    async waitForSplash(timeout: number = 15000): Promise<void> {
        await GM.waitForElement(this.splashScreenSelector, timeout);
    }
}
 
export default new SplashPage();