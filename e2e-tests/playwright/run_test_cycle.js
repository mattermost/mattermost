// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-await-in-loop, no-console */

/*
 * This command, which is normally used in CI, runs Playwright test in full or partial
 * depending on test metadata and environment capabilities.
 * Spec file to run is dependent from Test Automation Dashboard and each test result is being
 * recorded on a per spec file basis.
 *
 * Usage: [ENVIRONMENT] node run_test_cycle.js
 *
 * Environment:
 *   AUTOMATION_DASHBOARD_URL   : Dashboard URL
 *   AUTOMATION_DASHBOARD_TOKEN : Dashboard token
 *   REPO                       : Project repository, ex. mattermost-webapp
 *   BRANCH                     : Branch identifier from CI
 *   BUILD_ID                   : Build identifier from CI
 *   CI_BASE_URL                : Test server base URL in CI
 *
 * Example:
 * 1. "node run_test_cycle.js"
 *      - will run all the specs available from the Automation dashboard
 */

const axios = require('axios');
const axiosRetry = require('axios-retry');
const chalk = require('chalk');
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
    getSpecToTest,
    recordSpecResult,
    updateCycle,
    uploadScreenshot,
} = require('../cypress/utils/dashboard');
const {writeJsonToFile} = require('../cypress/utils/report');
const {MOCHAWESOME_REPORT_DIR, RESULTS_DIR} = require('../cypress/utils/constants');

require('dotenv').config();
axiosRetry(axios, {
    retries: 5,
    retryDelay: axiosRetry.exponentialDelay,
});

const {
    BRANCH,
    BROWSER,
    BUILD_ID,
    CI_BASE_URL,
    HEADLESS,
    REPO,
} = process.env;

async function runPlaywrightTest(specExecution) {
    const browser = BROWSER || 'chromium';
    const headless = isHeadless();
    
    // Create directories for reports if they don't exist
    if (!fs.existsSync(MOCHAWESOME_REPORT_DIR)) {
        fs.mkdirSync(MOCHAWESOME_REPORT_DIR, { recursive: true });
    }
    if (!fs.existsSync(`${MOCHAWESOME_REPORT_DIR}/screenshots`)) {
        fs.mkdirSync(`${MOCHAWESOME_REPORT_DIR}/screenshots`, { recursive: true });
    }
    if (!fs.existsSync(`${MOCHAWESOME_REPORT_DIR}/videos`)) {
        fs.mkdirSync(`${MOCHAWESOME_REPORT_DIR}/videos`, { recursive: true });
    }
    if (!fs.existsSync(`${MOCHAWESOME_REPORT_DIR}/json`)) {
        fs.mkdirSync(`${MOCHAWESOME_REPORT_DIR}/json`, { recursive: true });
    }

    // Prepare result object similar to Cypress
    const startTime = new Date();
    
    try {
        // Run the Playwright test using the test runner
        const { execSync } = require('child_process');
        
        const reportPath = path.join(MOCHAWESOME_REPORT_DIR, 'json', path.basename(specExecution.file, '.ts') + '.json');
        
        // Build the command with appropriate options
        const command = [
            'npx playwright test',
            specExecution.file,
            `--browser=${browser}`,
            headless ? '--headed=false' : '--headed',
            `--reporter=json,${reportPath}`,
            '--project=default',
        ].join(' ');
        
        console.log(chalk.blue(`Running command: ${command}`));
        execSync(command, { stdio: 'inherit' });
        
        // Read the test results from the JSON report
        const testResults = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        
        const endTime = new Date();
        
        // Format results to match Cypress format for dashboard
        return {
            cypressVersion: 'Playwright', // Using this field to indicate Playwright
            browserName: browser,
            browserVersion: 'latest', // Would need browser context to get actual version
            osName: os.platform(),
            osVersion: os.release(),
            runs: [{
                stats: {
                    passes: testResults.suites.reduce((sum, suite) => sum + suite.specs.filter(spec => spec.ok).length, 0),
                    failures: testResults.suites.reduce((sum, suite) => sum + suite.specs.filter(spec => !spec.ok).length, 0),
                    pending: 0,
                    skipped: testResults.suites.reduce((sum, suite) => sum + suite.specs.filter(spec => spec.skipped).length, 0),
                    duration: endTime - startTime,
                    startedAt: startTime.toISOString(),
                    endedAt: endTime.toISOString(),
                },
                tests: testResults.suites.flatMap(suite => 
                    suite.specs.map(spec => ({
                        title: [suite.title, spec.title],
                        body: spec.title,
                        attempts: [{
                            state: spec.ok ? 'passed' : (spec.skipped ? 'skipped' : 'failed'),
                            duration: spec.duration || 0,
                            startedAt: startTime.toISOString(),
                            screenshots: spec.attachments ? 
                                spec.attachments
                                    .filter(a => a.contentType.includes('image'))
                                    .map(a => ({ path: a.path })) : 
                                [],
                            error: spec.ok ? null : {
                                message: spec.errors ? spec.errors[0].message : 'Test failed',
                                codeFrame: {
                                    frame: spec.errors ? spec.errors[0].stack : 'No stack trace available'
                                }
                            }
                        }]
                    }))
                ),
                spec: {
                    relative: specExecution.file,
                    tests: testResults.suites.reduce((sum, suite) => sum + suite.specs.length, 0),
                }
            }]
        };
    } catch (error) {
        console.error(chalk.red('Error running Playwright test:'), error);
        
        const endTime = new Date();
        
        // Return a failure result
        return {
            cypressVersion: 'Playwright',
            browserName: browser,
            browserVersion: 'latest',
            osName: os.platform(),
            osVersion: os.release(),
            runs: [{
                stats: {
                    passes: 0,
                    failures: 1,
                    pending: 0,
                    skipped: 0,
                    duration: endTime - startTime,
                    startedAt: startTime.toISOString(),
                    endedAt: endTime.toISOString(),
                },
                tests: [{
                    title: ['Test execution error'],
                    body: 'Test execution failed',
                    attempts: [{
                        state: 'failed',
                        duration: endTime - startTime,
                        startedAt: startTime.toISOString(),
                        screenshots: [],
                        error: {
                            message: error.message,
                            codeFrame: {
                                frame: error.stack
                            }
                        }
                    }]
                }],
                spec: {
                    relative: specExecution.file,
                    tests: 1,
                }
            }]
        };
    }
}

async function saveResult(specExecution, result, testIndex) {
    // Write and update test environment details once
    if (testIndex === 0) {
        const environment = {
            playwright_version: result.cypressVersion,
            browser_name: result.browserName,
            browser_version: result.browserVersion,
            headless: isHeadless(),
            os_name: result.osName,
            os_version: result.osVersion,
            node_version: process.version,
        };

        writeJsonToFile(environment, 'environment.json', RESULTS_DIR);
        await updateCycle(specExecution.cycle_id, environment);
    }

    const {stats, tests, spec} = result.runs[0];

    const specPatch = {
        file: spec.relative,
        tests: spec.tests,
        pass: stats.passes,
        fail: stats.failures,
        pending: stats.pending,
        skipped: stats.skipped,
        duration: stats.duration || 0,
        test_start_at: stats.startedAt,
        test_end_at: stats.endedAt,
    };

    const testCases = [];
    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        const attempts = test.attempts.pop();

        const testCase = {
            title: test.title,
            full_title: test.title.join(' '),
            state: attempts.state,
            duration: attempts.duration || 0,
            code: trimToMaxLength(test.body),
        };

        if (attempts.startedAt) {
            testCase.test_start_at = attempts.startedAt;
        }

        if (test.displayError) {
            testCase.error_display = trimToMaxLength(test.displayError);
        }

        const errorFrame = attempts.error && attempts.error.codeFrame && attempts.error.codeFrame.frame;
        if (errorFrame) {
            testCase.error_frame = trimToMaxLength(errorFrame);
        }

        if (attempts.screenshots && attempts.screenshots.length > 0) {
            const path = attempts.screenshots[0].path;
            const screenshotUrl = await uploadScreenshot(path, REPO, BRANCH, BUILD_ID);
            if (typeof screenshotUrl === 'string' && !screenshotUrl.error) {
                testCase.screenshot = {url: screenshotUrl};
            }
        }

        testCases.push(testCase);
    }

    await recordSpecResult(specExecution.id, specPatch, testCases);
}

function isHeadless() {
    return typeof HEADLESS === 'undefined' ? true : HEADLESS === 'true';
}

function trimToMaxLength(text) {
    const maxLength = 5000;
    return text && text.length > maxLength ? text.substring(0, maxLength) : text;
}

function printSummary(summary) {
    const obj = summary.reduce((acc, item) => {
        const {server, state, count} = item;
        if (!server) {
            return acc;
        }

        if (acc[server]) {
            acc[server][state] = count;
        } else {
            acc[server] = {[state]: count, server};
        }

        return acc;
    }, {});

    Object.values(obj).sort((a, b) => {
        return a.server.localeCompare(b.server);
    }).forEach((item) => {
        const {server, done, started} = item;
        console.log(chalk.magenta(`${server}: done: ${done || 0}, started: ${started || 0}`));
    });
}

const maxRetryCount = 5;
async function runSpecFragment(count, retry) {
    console.log(chalk.magenta(`Preparing for: ${count + 1}`));

    const spec = await getSpecToTest({
        repo: REPO,
        branch: BRANCH,
        build: BUILD_ID,
        server: CI_BASE_URL,
    });

    // Retry on connection/timeout errors
    if (!spec || spec.code) {
        if (retry >= maxRetryCount) {
            return {
                tryNext: false,
                count,
                message: `Test ended due to multiple (${retry}) connection/timeout errors with the dashboard server.`,
            };
        }

        console.log(chalk.red(`Retry count: ${retry}`));
        return runSpecFragment(count, retry + 1);
    }

    if (!spec.execution || !spec.execution.file) {
        return {
            tryNext: false,
            count,
            message: spec.message,
        };
    }

    const currentTestCount = spec.summary.reduce((total, item) => {
        return total + parseInt(item.count, 10);
    }, 0);

    printSummary(spec.summary);
    console.log(chalk.magenta(`\n(Testing ${currentTestCount} of ${spec.cycle.specs_registered}) - ${spec.execution.file}`));
    console.log(chalk.magenta(`At "${process.env.CI_BASE_URL}" server`));

    const result = await runPlaywrightTest(spec.execution);
    await saveResult(spec.execution, result, count);

    const newCount = count + 1;

    if (spec.cycle.specs_registered === currentTestCount) {
        return {
            tryNext: false,
            count: newCount,
            message: `Completed testing of all registered ${currentTestCount} spec/s.`,
        };
    }

    return {
        tryNext: true,
        count: newCount,
        retry: 0,
        message: 'Continue testing',
    };
}

async function runSpec(count = 0, retry = 0) {
    const fragment = await runSpecFragment(count, retry);
    if (fragment.tryNext) {
        return runSpec(fragment.count, fragment.retry);
    }

    return {
        count: fragment.count,
        message: fragment.message,
    };
}

runSpec().then(({count, message}) => {
    console.log(chalk.magenta(message));
    if (count > 0) {
        console.log(chalk.magenta(`This test runner has completed ${count} spec file/s.`));
    }
});
