// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-await-in-loop, no-console */

/*
 * This command, which is normally used in CI, generates test cycle in full or partial
 * depending on test metadata and environment capabilities into the Test Automation Dashboard.
 * Such generated test cycle is then used to run each spec file by "node run_test_cycle.js".
 *
 * Usage: [ENVIRONMENT] node generate_test_cycle.js [options]
 *
 * Environment:
 *   AUTOMATION_DASHBOARD_URL   : Dashboard URL
 *   AUTOMATION_DASHBOARD_TOKEN : Dashboard token
 *   REPO                       : Project repository, ex. mattermost-webapp
 *   BRANCH                     : Branch identifier from CI
 *   BUILD_ID                   : Build identifier from CI
 *   BROWSER                    : Chrome by default. Set to run test on other browser such as chrome, edge, electron and firefox.
 *                                The environment should have the specified browser to successfully run.
 *   HEADLESS                   : Headless by default (true) or false to run on headed mode.
 *
 * Example:
 * 1. "node generate_test_cycle.js"
 *      - will create test cycle based on default test environment, except those matching skipped metadata
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const chalk = require('chalk');

// Use our own dashboard utility
const {createAndStartCycle} = require('./utils/dashboard');

require('dotenv').config();

const {
    BRANCH,
    BROWSER,
    BUILD_ID,
    HEADLESS,
    REPO,
} = process.env;

/**
 * Get test files with metadata
 * @param {string} platform - os platform
 * @param {string} browser - browser
 * @param {boolean} headless - true/false if test to run on headless mode
 * @returns {Object} weighted test files and spec files
 */
/**                                                                                                                                                                                                        
 * Get test files with metadata                                                                                                                                                                            
 * @param {string} platform - os platform                                                                                                                                                                  
 * @param {string} browser - browser                                                                                                                                                                       
 * @param {boolean} headless - true/false if test to run on headless mode                                                                                                                                  
 * @returns {Object} weighted test files and spec files                                                                                                                                                    
 */                                                                                                                                                                                                        
function getSortedTestFiles(platform, browser, headless) {                                                                                                                                                 
    // Define the base directory for Playwright tests                                                                                                                                                      
    const baseDir = path.join(__dirname, 'specs', 'functional');                                                                                                                                           
                                                                                                                                                                                                           
    // Get all spec files                                                                                                                                                                                  
    const specFiles = glob.sync('**/*.spec.ts', { cwd: baseDir }).map(file => path.join(baseDir, file));                                                                                                   
                                                                                                                                                                                                           
    // Parse metadata from spec files                                                                                                                                                                      
    const weightedTestFiles = specFiles.map(file => {                                                                                                                                                      
        const content = fs.readFileSync(file, 'utf8');                                                                                                                                                     
                                                                                                                                                                                                           
        // Extract metadata from file content (similar to how Cypress does it)                                                                                                                             
        const stageMatch = content.match(/@stage\s+(\S+)/);                                                                                                                                                
        const groupMatch = content.match(/@group\s+(\S+)/);                                                                                                                                                
                                                                                                                                                                                                           
        const stage = stageMatch ? stageMatch[1] : '';                                                                                                                                                     
        const group = groupMatch ? groupMatch[1] : '';                                                                                                                                                     
                                                                                                                                                                                                           
        // Determine if test should be skipped based on platform, browser, etc.                                                                                                                            
        const skipPlatformMatch = content.match(/@skip_if_platform\s+(\S+)/);                                                                                                                              
        const skipBrowserMatch = content.match(/@skip_if_browser\s+(\S+)/);                                                                                                                                
        const skipHeadlessMatch = content.match(/@skip_if_headless\s+(\S+)/);                                                                                                                              
                                                                                                                                                                                                           
        const skipPlatform = skipPlatformMatch ? skipPlatformMatch[1].includes(platform) : false;                                                                                                          
        const skipBrowser = skipBrowserMatch ? skipBrowserMatch[1].includes(browser) : false;                                                                                                              
        const skipHeadless = skipHeadlessMatch ? skipHeadlessMatch[1] === String(headless) : false;                                                                                                        
                                                                                                                                                                                                           
        const shouldSkip = skipPlatform || skipBrowser || skipHeadless;                                                                                                                                    
                                                                                                                                                                                                           
        return {                                                                                                                                                                                           
            file,                                                                                                                                                                                          
            stage,                                                                                                                                                                                         
            group,                                                                                                                                                                                         
            shouldSkip,                                                                                                                                                                                    
            weight: 1, // Default weight, can be adjusted based on test complexity                                                                                                                         
        };                                                                                                                                                                                                 
    });                                                                                                                                                                                                    
                                                                                                                                                                                                           
    // Filter out skipped tests                                                                                                                                                                            
    const filteredTestFiles = weightedTestFiles.filter(file => !file.shouldSkip);                                                                                                                          
                                                                                                                                                                                                           
    return {                                                                                                                                                                                               
        weightedTestFiles: filteredTestFiles,                                                                                                                                                              
        specFiles: filteredTestFiles.map(item => item.file),                                                                                                                                               
    };                                                                                                                                                                                                     
}

async function main() {
    const browser = BROWSER || 'chromium'; // Default to chromium for Playwright
    const headless = typeof HEADLESS === 'undefined' ? true : HEADLESS === 'true';
    const platform = os.platform();
    const {weightedTestFiles} = getSortedTestFiles(platform, browser, headless);

    if (!weightedTestFiles.length) {
        console.log(chalk.red('Nothing to test!'));
        return;
    }

    try {
        const data = await createAndStartCycle({
            repo: REPO || 'mattermost-webapp',
            branch: BRANCH || 'master',
            build: BUILD_ID || `playwright-${Date.now()}`,
            files: weightedTestFiles,
        });

        console.log(chalk.green('Successfully generated a test cycle.'));
        if (data && data.cycle) {
            console.log(chalk.cyan('Cycle ID:'), data.cycle.id);
            console.log(chalk.cyan('Specs registered:'), data.cycle.specs_registered);
        } else {
            console.log(chalk.yellow('Warning: Received unexpected response format from dashboard'));
            console.log(chalk.yellow('Response data:'), JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error(chalk.red('Error generating test cycle:'));
        console.error(chalk.red(error.message));
        if (error.response) {
            console.error(chalk.red('Response status:'), error.response.status);
            console.error(chalk.red('Response data:'), error.response.data);
        }
    }
}

main();
