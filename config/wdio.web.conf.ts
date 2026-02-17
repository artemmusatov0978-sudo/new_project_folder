import { config } from './wdio.shared.conf';
var path = require('path');
const pathToDownload = path.resolve('./chromeDownloads');

//
// ======
// Appium
// ======
//
config.services = (config.services ? config.services : []).concat([
    [
        // 'chrome',
        'chromedriver',
        {
            // port: 5555,
            // drivers: { firefox: '0.29.1', chrome: true, chromiumedge: 'latest' },

            // args: {
            //     seleniumArgs: ['--port', '5555'],
            // },

            // args: [
            //     'user-data-dir=./chrome/user-data',
            // ],
            prefs: {
                // "homepage":'yahoo.com',
                
                "download.default_directory": './chromeDownloads',
                // "download.directory_upgrade": true,
                
            }
        }



    ],
]);
//
// =====================
// Server Configurations
// =====================
//
// config.port = 7676;
// config.protocol = 'http';

export default config;