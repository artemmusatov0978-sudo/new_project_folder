import { join } from 'node:path';
import { config as baseConfig } from './wdio.shared.local.appium.conf.js';

const isGhActions = process.env.GITHUB_ACTION;

export const config: WebdriverIO.Config = {
    ...baseConfig,

    // ============
    // Specs
    // ============
    specs: [
        // '../tests/specs/**/app*.spec.ts'],
        '../tests/specs/kredo/**/kredo.ios.**.spec.ts'
    ],
    // ============
    // Capabilities
    // ============
    // For all capabilities please check
    // http://appium.io/docs/en/writing-running-appium/caps/#general-capabilities
    capabilities: [
        {
            // The defaults you need to have in your config
            platformName: 'iOS',
            // maxInstances: 1,
            "wdio:maxInstances": 1,
            // For W3C the appium capabilities need to have an extension prefix
            // This is `appium:` for all Appium Capabilities which can be found here
            // http://appium.io/docs/en/writing-running-appium/caps/

            //
            // NOTE: Change this name according to the Simulator you have created on your local machine
            'appium:deviceName': 'iPhone 13 mini',
            // 'appium:platformVersion': '15.5',
            'appium:platformVersion': '18.4.1',
            // 'appium:language': 'Українська',
            'appium:orientation': 'PORTRAIT',
            'appium:automationName': 'XCUITest',
            "appium:wdaLocalPort": 8103,
            'appium:udid': '00008110-000039593E99801E',
            // The path to the app
            'appium:app': join(process.cwd(), './apps/iBankKredo-Test-rd.app.zip'),
            // Read the reset strategies very well, they differ per platform, see
            // http://appium.io/docs/en/writing-running-appium/other/reset-strategies/
            'appium:noReset': true,
            'appium:newCommandTimeout': 240,
            // This is needed to wait for the webview context to become available
            'appium:autoAcceptAlerts': true
            // 'appium:showXcodeLog': true
        }
    ]
};
