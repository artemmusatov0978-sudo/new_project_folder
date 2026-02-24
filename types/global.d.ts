declare global {
    const driver: WebdriverIO.Browser;
    function $( selector: string): Promise<WebdriverIO.Element>;
    function $$( selector: string): Promise<WebdriverIO.Element[]>;
}
export {};