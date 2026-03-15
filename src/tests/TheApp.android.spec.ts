import { expect } from '@wdio/globals';
import { main } from 'appium';
import { SchemaNameConflictError } from 'appium/build/lib/schema/schema';
import { describe, it } from 'mocha';
import splashPage from '../../pageobjects/splash.page';
import mainPage from '../../pageobjects/main.page';
import GM from '../../helpers/global.methods';
import { TD } from '../../data/test.data';
import LoginScreen from '../../pageobjects/LoginScreen';

describe('Login Screen', () => {
 
    it('Verify Login screen is displayed - Android', async () => {
 
        await LoginScreen.waitForScreen();
 
        const isDisplayed = await LoginScreen.isLoginScreenDisplayed();
 
        console.log('Login screen displayed:', isDisplayed);
 
        await expect(isDisplayed).toBe(true);
 
    });
 
});