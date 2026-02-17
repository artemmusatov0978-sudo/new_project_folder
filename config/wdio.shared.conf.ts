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
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json',
    },
  },
};