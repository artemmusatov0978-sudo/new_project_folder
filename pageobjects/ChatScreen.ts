class ChatScreen {
    messageInputSelectors: { className: string; iOSClassChain: string; iOSPredicate: string; xpath: string; };
    
    constructor() {
        this.messageInputSelectors = {
            className: 'XCUIElementTypeTextField',
            iOSClassChain: '-ios class chain:**/XCUIElementTypeTextField[`name == "messageinput"`]',
            iOSPredicate: '-ios predicate string:name == "messageinput" AND label == "messageinput" AND value == "messageinput"',
            xpath: '//XCUIElementTypeTextField[@name="messageinput"]'
        };
    }
 
    async enterMessage(text:any) {
        try {
            const messageInput = await $(this.messageInputSelectors.iOSClassChain);
            await messageInput.waitForDisplayed({ timeout: 5000 });
            await messageInput.setValue(text);
            console.log(`Entered message: ${text}`);
        } catch (error) {
            console.error('Failed to enter message', error);
            throw error;
        }
    }
 
    async getMessageValue() {
        const messageInput = await $(this.messageInputSelectors.iOSClassChain);
        return await messageInput.getValue();
    }
 
    async clearMessage() {
        const messageInput = await $(this.messageInputSelectors.iOSClassChain);
        await messageInput.clearValue();
    }
 
  
}
 
export default new ChatScreen();