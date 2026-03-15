import GM from "../helpers/global.methods";
 
class LoginScreen {
    loginScreenTitle: string;
    constructor() {
        this.loginScreenTitle = '~Login Screen A fake login scree for testing';
    }
    get EchoScreenInputField() {
        return $('XCUIElementTypeTextField');
    }
    async waitForScreen() {
        try {
            console.log(' Waiting for Login Screen...');
            await GM.waitForElement(this.loginScreenTitle);
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