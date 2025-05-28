// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, camelcase */

const axios = require('axios');
const fse = require('fs-extra');
const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs.extend(duration);

const {MOCHAWESOME_REPORT_DIR, AD_CYCLE_FILE} = require('./constants');

const MAX_FAILED_TITLES = 5;

let incrementalDuration = 0;

function getAllTests(results) {
    const tests = [];
    results.forEach((result) => {
        result.tests.forEach((test) => {
            incrementalDuration += test.duration;
            tests.push({...test, incrementalDuration});
        });

        if (result.suites.length > 0) {
            getAllTests(result.suites).forEach((test) => tests.push(test));
        }
    });

    return tests;
}

function generateStatsFieldValue(stats, failedFullTitles) {
    const startAt = dayjs(stats.start);
    const endAt = dayjs(stats.end);
    const statsDuration = dayjs.duration(endAt.diff(startAt)).format('H:mm:ss');

    let statsFieldValue = `
| Key | Value |
|:---|:---|
| Passing Rate | ${stats.passPercent.toFixed(2)}% |
| Duration | ${statsDuration} |
| Suites | ${stats.suites} |
| Tests | ${stats.tests} |
| :white_check_mark: Passed | ${stats.passes} |
| :x: Failed | ${stats.failures} |
| :fast_forward: Skipped | ${stats.skipped} |
`;

    // If present, add full title of failing tests.
    // Only show per maximum number of failed titles with the last item as "more..." if failing tests are more than that.
    let failedTests;
    if (failedFullTitles && failedFullTitles.length > 0) {
        const re = /[:'"\\]/gi;
        const failed = failedFullTitles;
        if (failed.length > MAX_FAILED_TITLES) {
            failedTests = failed.slice(0, MAX_FAILED_TITLES - 1).map((f) => `- ${f.replace(re, '')}`).join('\n');
            failedTests += '\n- more...';
        } else {
            failedTests = failed.map((f) => `- ${f.replace(re, '')}`).join('\n');
        }
    }

    if (failedTests) {
        statsFieldValue += '###### Failed Tests:\n' + failedTests;
    }

    return statsFieldValue;
}

function generateShortSummary(report) {
    const {results, stats} = report;
    const tests = getAllTests(results);

    const failedFullTitles = tests.filter((t) => t.fail).map((t) => t.fullTitle);
    const statsFieldValue = generateStatsFieldValue(stats, failedFullTitles);

    // If AD Cycle file is found, we have data from the Automation Dashboard available
    // We are able to override the run stats with enriched information
    const adCycle = readJsonFromFile(AD_CYCLE_FILE);
    if (!(adCycle instanceof Error)) {
        stats.passes = adCycle.pass;
        stats.failures = adCycle.fail;
        stats.tests = adCycle.pass + adCycle.fail;
        stats.passPercent = 100 * (stats.passes / stats.tests);
    }

    return {
        stats,
        statsFieldValue,
    };
}

function removeOldGeneratedReports() {
    [
        'all.json',
        'summary.json',
        'mochawesome.html',
    ].forEach((file) => fse.removeSync(`${MOCHAWESOME_REPORT_DIR}/${file}`));
}

function writeJsonToFile(jsonObject, filename, dir) {
    fse.writeJson(`${dir}/${filename}`, jsonObject).
        then(() => console.log('Successfully written:', filename)).
        catch((err) => console.error(err));
}

function readJsonFromFile(file) {
    try {
        return fse.readJsonSync(file);
    } catch (err) {
        return {err};
    }
}

const result = [
    {status: 'Passed', priority: 'none', cutOff: 100, color: '#43A047'},
    {status: 'Failed', priority: 'low', cutOff: 98, color: '#FFEB3B'},
    {status: 'Failed', priority: 'medium', cutOff: 95, color: '#FF9800'},
    {status: 'Failed', priority: 'high', cutOff: 0, color: '#F44336'},
];

function generateTestReport(summary, isUploadedToS3, reportLink, environment, testCycleKey) {
    const {
        FULL_REPORT,
        TEST_CYCLE_LINK_PREFIX,
        MM_ENV,
        SERVER_TYPE,
        BUILD_ID,
        AUTOMATION_DASHBOARD_FRONTEND_URL,
    } = process.env;
    const {statsFieldValue, stats} = summary;
    const {
        cypress_version,
        browser_name,
        browser_version,
        headless,
        os_name,
        os_version,
        node_version,
    } = environment;

    let testResult;
    for (let i = 0; i < result.length; i++) {
        if (stats.passPercent >= result[i].cutOff) {
            testResult = result[i];
            break;
        }
    }

    const title = generateTitle();
    const runnerEnvValue = `cypress@${cypress_version} | node@${node_version} | ${browser_name}@${browser_version}${headless ? ' (headless)' : ''} | ${os_name}@${os_version}`;

    if (FULL_REPORT === 'true') {
        let reportField;
        if (isUploadedToS3) {
            reportField = {
                short: false,
                title: 'Test Report',
                value: `[Link to the report](${reportLink})`,
            };
        }

        let testCycleField;
        if (testCycleKey) {
            testCycleField = {
                short: false,
                title: 'Test Execution',
                value: `[Recorded test executions](${TEST_CYCLE_LINK_PREFIX}${testCycleKey})`,
            };
        }

        let serverEnvField;
        if (MM_ENV) {
            serverEnvField = {
                short: false,
                title: 'Test Server Override',
                value: MM_ENV,
            };
        }

        let serverTypeField;
        if (SERVER_TYPE) {
            serverTypeField = {
                short: false,
                title: 'Test Server',
                value: SERVER_TYPE,
            };
        }

        return {
            username: 'Cypress UI Test',
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            attachments: [{
                color: testResult.color,
                author_name: 'Webapp End-to-end Testing',
                author_icon: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
                author_link: 'https://www.mattermost.com',
                title,
                fields: [
                    {
                        short: false,
                        title: 'Environment',
                        value: runnerEnvValue,
                    },
                    serverTypeField,
                    serverEnvField,
                    reportField,
                    testCycleField,
                    {
                        short: false,
                        title: `Key metrics (required support: ${testResult.priority})`,
                        value: statsFieldValue,
                    },
                ],
            }],
        };
    }

    let quickSummary = `${stats.passPercent.toFixed(2)}% (${stats.passes}/${stats.tests}) in ${stats.suites} suites`;
    if (isUploadedToS3) {
        quickSummary = `[${quickSummary}](${reportLink})`;
    }

    let testCycleLink = '';
    if (testCycleKey) {
        testCycleLink = testCycleKey ? `| [Recorded test executions](${TEST_CYCLE_LINK_PREFIX}${testCycleKey})` : '';
    }

    const automationDashboardField = AUTOMATION_DASHBOARD_FRONTEND_URL ? `| [Automation Dashboard](${AUTOMATION_DASHBOARD_FRONTEND_URL}/cycle/${BUILD_ID})` : '';

    const rollingReleaseMatchRegex = BUILD_ID.match(/-rolling(?<version>[^-]+)-/);
    const rollingReleaseFrom = rollingReleaseMatchRegex?.groups?.version;
    const rollingReleaseFromField = rollingReleaseFrom ? `\nRolling release upgrade from: ${rollingReleaseFrom}` : '';

    const startAt = dayjs(stats.start);
    const endAt = dayjs(stats.end);
    const statsDuration = dayjs.duration(endAt.diff(startAt)).format('H:mm:ss');

    return {
        username: 'Cypress UI Test',
        icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
        attachments: [{
            color: testResult.color,
            author_name: 'Webapp End-to-end Testing',
            author_icon: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            author_link: 'https://www.mattermost.com/',
            title,
            text: `${quickSummary} | ${statsDuration} ${testCycleLink} ${automationDashboardField}\n${runnerEnvValue}${SERVER_TYPE ? '\nTest server: ' + SERVER_TYPE : ''}${rollingReleaseFromField}${MM_ENV ? '\nTest server override: ' + MM_ENV : ''}`,
        }],
    };
}

function generateTitle() {
    const {
        BRANCH,
        MM_DOCKER_IMAGE,
        MM_DOCKER_TAG,
        PULL_REQUEST,
        RELEASE_DATE,
        TYPE,
    } = process.env;

    let dockerImageLink = '';
    if (MM_DOCKER_IMAGE && MM_DOCKER_TAG) {
        dockerImageLink = ` with [${MM_DOCKER_IMAGE}:${MM_DOCKER_TAG}](https://hub.docker.com/r/mattermostdevelopment/${MM_DOCKER_IMAGE}/tags?name=${MM_DOCKER_TAG})`;
    }

    let releaseDate = '';
    if (RELEASE_DATE) {
        releaseDate = ` for ${RELEASE_DATE}`;
    }

    let title;

    switch (TYPE) {
    case 'PR':
        title = `E2E for Pull Request Build: [${BRANCH}](${PULL_REQUEST})${dockerImageLink}`;
        break;
    case 'RELEASE':
        title = `E2E for Release Build${dockerImageLink}${releaseDate}`;
        break;
    case 'MASTER':
        title = `E2E for Master Nightly Build (Prod tests)${dockerImageLink}`;
        break;
    case 'MASTER_UNSTABLE':
        title = `E2E for Master Nightly Build (Unstable tests)${dockerImageLink}`;
        break;
    case 'CLOUD':
        title = `E2E for Cloud Build (Prod tests)${dockerImageLink}${releaseDate}`;
        break;
    case 'CLOUD_UNSTABLE':
        title = `E2E for Cloud Build (Unstable tests)${dockerImageLink}`;
        break;
    default:
        title = `E2E for Build${dockerImageLink}`;
    }

    return title;
}

function generateDiagnosticReport(summary, serverInfo) {
    const {BRANCH, BUILD_ID} = process.env;

    return {
        username: 'Cypress UI Test',
        icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
        attachments: [{
            color: '#43A047',
            author_name: 'Cypress UI Test',
            author_icon: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            author_link: 'https://community.mattermost.com/core/channels/ui-test-automation',
            title: `Cypress UI Test Automation #${BUILD_ID}, **${BRANCH}** branch`,
            fields: [{
                short: false,
                value: `Start: **${summary.stats.start}**\nEnd: **${summary.stats.end}**\nUser ID: **${serverInfo.userId}**\nTeam ID: **${serverInfo.teamId}**`,
            }],
        }],
    };
}

async function sendReport(name, url, data) {
    const requestOptions = {method: 'POST', url, data};

    try {
        const response = await axios(requestOptions);

        if (response.data) {
            console.log(`Successfully sent ${name}.`);
        }
        return response;
    } catch (er) {
        console.log(`Something went wrong while sending ${name}.`, er);
        return false;
    }
}

module.exports = {
    generateDiagnosticReport,
    generateShortSummary,
    generateTestReport,
    getAllTests,
    removeOldGeneratedReports,
    sendReport,
    readJsonFromFile,
    writeJsonToFile,
};
