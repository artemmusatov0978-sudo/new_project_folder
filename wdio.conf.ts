import type { Options } from '@wdio/types';
import { ReporterConfig } from './custom-reporter';

const reporterConfig: ReporterConfig = {
  outputDir: 'reports/wdio-report',
  reportTitle: 'Test Report',
  companyName: 'Test Name',
  projectName: 'Test Project',
  theme: 'dark',
  primaryColor: '#0ea5e9',
  language: 'uk',
  // logo: './assets/logo.png', // path or base64 data URL
  showPassedTests: true,
  showSkippedTests: true,
  showEnvironmentInfo: true,
  includeScreenshots: true,
  includeVideos: false,
  includeLogs: true,
  includeTimings: true,
};

export const config: Options.Testrunner = {
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './tsconfig.json',
      transpileOnly: true,
    },
  },

  specs: ['../src/tests/**/*.spec.ts'],
  exclude: [],

  maxInstances: 5,

  capabilities: [{
    maxInstances: 5,
    browserName: 'chrome',
    acceptInsecureCerts: true,
  }],

  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  reporters: [
    'spec',
    ['@rpii/wdio-html-reporter', {
      outputDir: 'reports/wdio-report',
      filename: 'report.html',
      reportTitle: 'Test Report',
      showInBrowser: true,
      collapseTests: false,
      logLevel: 'info',
    }]
  ],

  afterTest: async function(test, context, { error, result, duration, passed }) {
    if (!passed) {
      await browser.saveScreenshot(`reports/wdio-report/screenshots/${test.title.replace(/\s/g, '_')}.png`);
    }
  },
};