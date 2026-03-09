import GM from "../helpers/global.methods";
class LoginScreen {
    loginScreenTitle: string;
    EchoScreenImputField: Promise<WebdriverIO.Element>;

    constructor() {
        this.loginScreenTitle = '~Login Screen A fake login screen for testing';
        this.EchoScreenImputField = $('XCUIElementTypeTextField');
    }
 
    async waitForScreen() {
        try {
            console.log(' Waiting for Login Screen...');
            const element = await $(this.loginScreenTitle);
            await element.waitForDisplayed({
                timeout: 10000,
                timeoutMsg: ' Login Screen not visible'
            });
            console.log('Login Screen is visible');
        } catch (error) {
            console.error('Error while waiting Login Screen');
            console.error(error);
            throw error;
        }
    }
 
    async isLoginScreenDisplayed() {
        const element = await $(this.loginScreenTitle);
        return await element.isDisplayed();
    }
}
 
export default new LoginScreen();