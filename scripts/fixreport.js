import fs from "node:fs"
import path from "node:path";
// const fs = require('fs');
// const path = require('path');

const resultsDir = './reports/allure-report';

fs.readdirSync(resultsDir).forEach(file => {
    if (file.endsWith('.json')) {
        const filePath = path.join(resultsDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (content.status != 'failed') {
            console.log('doing the job');
            if (content.statusDetails) {
                if (content.statusDetails.trace.includes('Error')) {
                    console.log('jobs done');
                    
                    content.status = 'failed';
                    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
                }
            }
        }
    }
});

console.log('Updated all "broken" statuses to "failed".');