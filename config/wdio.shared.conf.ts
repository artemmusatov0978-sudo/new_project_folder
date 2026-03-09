import type { Options } from '@wdio/types';
export const config: Options.Testrunner = {
  runner: 'local',
  framework: 'mocha',
  specs: ['../src/tests/**/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [],
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:4723',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: [
    [
      'appium',
      {
        args: {
          address: '127.0.0.1',
          port: 4723,
        },
        command: 'appium',
        logPath: './logs/',
      },
    ],
  ],
 reporters: [
    'spec',
    ['./custom-reporter.ts', {
      outputDir: 'reports/appium-report',
      reportTitle: 'Android Test Report',
      companyName: 'My Company',
      projectName: 'Android E2E',
      theme: 'light',
      primaryColor: '#3ddc84',                 
      language: 'uk',
      showPassedTests: true,
      showSkippedTests: true,
      includeScreenshots: true,
      showEnvironmentInfo: true,
    }]
  ],
 

  afterTest: async function(test, ctx, { passed }) {
    if (!passed) {
      const dir = 'reports/appium-report/screenshots';
      const name = test.title.replace(/\s/g, '_');
      await driver.saveScreenshot(`${dir}/${name}.png`);
    }
  },

  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json',
    },
  },
};