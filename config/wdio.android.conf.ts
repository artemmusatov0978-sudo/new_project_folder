import { join } from 'node:path';
import { config as sharedConfig } from './wdio.shared.conf';
 
export const config: WebdriverIO.Config = {
  ...sharedConfig,
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Pixel_4_11',
      'appium:platformVersion': '11',
      'appium:udid': 'emulator-5554',
      //'appium:app': './app/General-Store.apk',
      'appium:app': join(
                process.cwd(),
                'app',
                //
                // NOTE: Change this name according to the app version you downloaded
                'General-Store.apk',
            ),
      'appium:appPackage': '', 
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:newCommandTimeout': 180000,
      'appium:chromedriverExecutable': '',
      'appium:uiautomator2ServerLaunchTimeout': 180000,
      'appium:adbExecTimeout': 180000,
    },
  ],
};