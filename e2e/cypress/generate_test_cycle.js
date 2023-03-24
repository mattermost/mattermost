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
 * Options:
 *   --stage=[stage]
 *      Selects spec files with matching stage. It can be of multiple values separated by comma.
 *      E.g. "--stage='@prod,@dev'" will select files with either @prod or @dev.
 *   --group=[group]
 *      Selects spec files with matching group. It can be of multiple values separated by comma.
 *      E.g. "--group='@channel,@messaging'" will select files with either @channel or @messaging.
 *   --invert
 *      Selected files are those not matching any of the specified stage or group.
 *   --include-group=[group]
 *      Include spec files with matching group. It can be of multiple values separated by comma.
 *      E.g. "--include-group='@enterprise'" will select files including @enterprise.
 *   --exclude-group=[group]
 *      Exclude spec files with matching group. It can be of multiple values separated by comma.
 *      E.g. "--exclude-group='@enterprise'" will select files except @enterprise.
 *   --include-file=[filename or directory]
 *      Include spec files with matching directory or filename pattern. Uses `find` command under the hood. It can be of multiple values separated by comma.
 *      E.g. "--include-file='channel'" will include files recursively under `channel` directory/s.
 *      E.g. "--include-file='*channel*'" will include files and files under directory/s recursively that matches the name with `*channel*`.
 *   --exclude-file=[filename or directory]
 *      Exclude spec files with matching directory or filename pattern. Uses `find` command under the hood. It can be of multiple values separated by comma.
 *      E.g. "--exclude-file='channel'" will exclude files recursively under `channel` directory/s.
 *      E.g. "--exclude-file='*channel*'" will exclude files and files under directory/s recursively that matches the name with `*channel*`.

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
 *   CI_BASE_URL                : Test server base URL in CI
 *
 * Example:
 * 1. "node generate_test_cycle.js"
 *      - will create test cycle based on default test environment, except those matching skipped metadata
 * 2. "node generate_test_cycle.js --stage='@prod'"
 *      - will create test cycle for production tests, except those matching skipped metadata
 * 3. "node generate_test_cycle.js --stage='@prod' --invert"
 *      - will create test cycle for all non-production tests
 * 4. "BROWSER='chrome' HEADLESS='false' node generate_test_cycle.js --stage='@prod' --group='@channel,@messaging'"
 *      - will create test cycle for spec files matching stage and group values in Chrome (headed)
 * 5. "node generate_test_cycle.js --stage='@prod' --exclude-group='@enterprise'"
 *      - will create test cycle for all production tests except @enterprise group
 *      - typical test run for Team Edition
 * 6. "node generate_test_cycle.js --stage='@prod' --sort-first='@elasticsearch' --sort-last='@mfa'"
 *      - will create test cycle for all production tests with specs specifically ordered as first and last
 */

const os = require('os');

const chalk = require('chalk');

const {createAndStartCycle} = require('./utils/dashboard');
const {getSortedTestFiles} = require('./utils/file');

require('dotenv').config();

const {
    BRANCH,
    BROWSER,
    BUILD_ID,
    HEADLESS,
    REPO,
} = process.env;

async function main() {
    const browser = BROWSER || 'chrome';
    const headless = typeof HEADLESS === 'undefined' ? true : HEADLESS === 'true';
    const platform = os.platform();
    const {weightedTestFiles} = getSortedTestFiles(platform, browser, headless);

    if (!weightedTestFiles.length) {
        console.log(chalk.red('Nothing to test!'));
        return;
    }

    const data = await createAndStartCycle({
        repo: REPO,
        branch: BRANCH,
        build: BUILD_ID,
        files: weightedTestFiles,
    });

    console.log(chalk.green('Successfully generated a test cycle.'));
    console.log(data.cycle);
}

main();
