


export async function waitForElement(
    selector: string,
    timeout: number = 15000
): Promise<WebdriverIO.Element> {
    const el = await $(selector);
    await el.waitForDisplayed({ timeout });
    return el;
}
export async function waitForElementAndClick(
    selector: string,
    timeout: number = 15000
): Promise<WebdriverIO.Element> {
    const el = await waitForElement(selector, timeout);
    await el.click();
    return el;
}

export async function waitForElementByText(
    text: string,
    timeout: number = 15000
): Promise<WebdriverIO.Element> {
    return waitForElement(`android=new UiSelector().text("${text}")`, timeout);
}

export async function waitForElementAndSetValue(
    selector: string,
    value: string,
    timeout: number = 15000
): Promise<WebdriverIO.Element> {
    const el = await waitForElement(selector, timeout);
    await el.setValue(value);
    return el;
}

export async function scrollToText(
    text: string,
    timeout: number = 180000
): Promise<WebdriverIO.Element> {
    const el = await $(
        `android=new UiScrollable(new UiSelector().scrollable(true)).scrollTextIntoView("${text}")`
    );
    await el.waitForDisplayed({ timeout });
    return el;
}

export async function scrollToTextAndClick(
    text: string,
    timeout: number = 180000
): Promise<WebdriverIO.Element> {
    const el = await scrollToText(text, timeout);
    await el.click();
    return el;
}

export async function scrollDown(percent: number = 0.7): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    await driver.action('pointer')
        .move({ x: Math.round(width / 2), y: Math.round(height * percent) })
        .down()
        .move({ x: Math.round(width / 2), y: Math.round(height * (1 - percent)) })
        .up()
        .perform();
}

export async function scrollUp(percent: number = 0.7): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    await driver.action('pointer')
        .move({ x: Math.round(width / 2), y: Math.round(height * (1 - percent)) })
        .down()
        .move({ x: Math.round(width / 2), y: Math.round(height * percent) })
        .up()
        .perform();
}

export async function scrollToElement(
    selector: string
): Promise<WebdriverIO.Element> {
    const el = await $(selector);
    await el.scrollIntoView();
    return el;
}
 
type SwipeDirection = 'left' | 'right' | 'up' | 'down';
 
export async function swipe(
    direction: SwipeDirection,
    percent: number = 0.7
): Promise<void> {
    const { width, height } = await driver.getWindowSize();
 
    const coords: Record<SwipeDirection, { startX: number; startY: number; endX: number; endY: number }> = {
        left:  { startX: width * percent,       startY: height / 2,          endX: width * (1 - percent),  endY: height / 2 },
        right: { startX: width * (1 - percent), startY: height / 2,          endX: width * percent,        endY: height / 2 },
        down:  { startX: width / 2,             startY: height * (1-percent), endX: width / 2,             endY: height * percent },
        up:    { startX: width / 2,             startY: height * percent,     endX: width / 2,             endY: height * (1 - percent) },
    };
 
    const { startX, startY, endX, endY } = coords[direction];
 
    await driver.action('pointer')
        .move({ x: Math.round(startX), y: Math.round(startY) })
        .down()
        .move({ x: Math.round(endX),   y: Math.round(endY) })
        .up()
        .perform();
}

export async function hideKeyboard(): Promise<void> {
    try {
        await driver.hideKeyboard();
    } catch {
    }
}

export async function swipeOnElement(
    selector: string,
    direction: 'left' | 'right' = 'left'
): Promise<void> {
    const el = await $(selector);
    const loc  = await el.getLocation();
    const size = await el.getSize();
 
    const startX  = direction === 'left' ? loc.x + size.width * 0.8 : loc.x + size.width * 0.2;
    const endX    = direction === 'left' ? loc.x + size.width * 0.2 : loc.x + size.width * 0.8;
    const centerY = loc.y + size.height / 2;
 
    await driver.action('pointer')
        .move({ x: Math.round(startX),  y: Math.round(centerY) })
        .down()
        .move({ x: Math.round(endX),    y: Math.round(centerY) })
        .up()
        .perform();
}

export async function pressBack(): Promise<void> {
    await driver.pressKeyCode(4);
}

export async function pressHome(): Promise<void> {
    await driver.pressKeyCode(3);
}

export async function isChecked(selector: string): Promise<boolean> {
    const el = await $(selector);
    return (await el.getAttribute('checked')) === 'true';
}

export async function isEnabled(selector: string): Promise<boolean> {
    const el = await $(selector);
    return (await el.getAttribute('enabled')) === 'true';
}

export async function getText(selector: string): Promise<string> {
    const el = await $(selector);
    return el.getText();
}

export async function acceptAlert(): Promise<void> {
    try {
        await driver.acceptAlert();
    } catch {
    }
}
 
export async function dismissAlert(): Promise<void> {
    try {
        await driver.dismissAlert();
    } catch {
    }
}

export async function pause(ms: number = 500): Promise<void> {
    await driver.pause(ms);
}

export async function takeScreenshot(name: string = 'screenshot'): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await driver.saveScreenshot(`./reports/screenshots/${name}_${timestamp}.png`);
}

export async function restartApp(bundleId: string = 'com.androidsample.generalstore'): Promise<void> {
    await driver.terminateApp(bundleId);
    await driver.activateApp(bundleId);
}




