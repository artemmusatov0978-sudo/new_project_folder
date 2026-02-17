import { join } from 'node:path';
import { config as baseConfig } from './wdio.shared.local.appium.conf.js';

export const config: WebdriverIO.Config = {
    ...baseConfig,

    // ============
    // Specs
    // ============
    specs: [
        // '../tests/specs/**/app*.spec.ts',
        // './tests/specs/kredo/**/kredo.android.**.spec.ts',
        '../tests/specs/kredo/kredo.android2.**.spec.ts',
        // '../tests/specs/kredo/1kredo.android.temp.spec.ts',
        // 'D:/automationprojectKredo/automatrionprojectkredo2/automation-kredo2/tests/specs/kredo/1kredo.android.temp.spec.ts',
    ],

    // ============
    // Capabilities
    // ============
    // For all capabilities please check
    // https://github.com/appium/appium-uiautomator2-driver
    capabilities: [
        // {
        //     // The defaults you need to have in your config
        //     platformName: 'Android',
        //     // maxInstances: 1,
        //     "wdio:maxInstances": 1,
        //     // For W3C the appium capabilities need to have an extension prefix
        //     // This is `appium:` for all Appium Capabilities which can be found here

        //     //
        //     // NOTE: Change this name according to the Emulator you have created on your local machine
        //     'appium:deviceName': 'Pixel_4_11',
        //     'appium:platformVersion': '11',
        //     // 'appium:deviceName': 'Pixel_36',
        //     // 'appium:platformVersion': '16',
        //     // 'appium:orientation': 'PORTRAIT',
        //     'appium:systemPort': 8200,
        //     'appium:automationName': 'UiAutomator2',
        //     // The path to the app
        //     'appium:app': join(
        //         process.cwd(),
        //         'apps',
        //         //
        //         // NOTE: Change this name according to the app version you downloaded
        //         'kredobank-dev-debug.apk',
        //     ),
        //     // 'appium:appWaitActivity': 'com.wdiodemoapp.MainActivity',
        //     'appium:noReset': true,
        //     'appium:newCommandTimeout': 240,
        // },

        {
            // The defaults you need to have in your config
            platformName: 'Android',
            // maxInstances: 1,
            "wdio:maxInstances": 1,
            // For W3C the appium capabilities need to have an extension prefix
            // This is `appium:` for all Appium Capabilities which can be found here

            //
            // NOTE: Change this name according to the Emulator you have created on your local machine
            'appium:deviceName': 'Pixel_4_11_2',
            'appium:platformVersion': '11',
            'appium:udid': 'emulator-5556',
            // 'appium:deviceName': 'Pixel_36',
            // 'appium:platformVersion': '16',
            // 'appium:orientation': 'PORTRAIT',
            // 'appium:systemPort': 8202,emulator-5556
            // 'appium:port': 4725,
            'appium:automationName': 'UiAutomator2',
            // The path to the app
            'appium:app': join(
                process.cwd(),
                'apps',
                //
                // NOTE: Change this name according to the app version you downloaded
                'kredobank-dev-debug.apk',
            ),
            // 'appium:appWaitActivity': 'com.wdiodemoapp.MainActivity',
            'appium:noReset': true,
            'appium:newCommandTimeout': 240,
        },

    ],
};
