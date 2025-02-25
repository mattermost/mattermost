#!/usr/bin/env node

const fs = require('fs');
const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs.extend(duration);

const {TYPE, SERVER_TYPE, BRANCH, PULL_REQUEST, BUILD_ID, MM_ENV, MM_DOCKER_IMAGE, MM_DOCKER_TAG, RELEASE_DATE} =
    process.env;

const resultsFile = 'results/reporter/results.json';
const summaryFile = 'results/summary.json';
const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
const passRate = (summary.passed * 100) / (summary.passed + summary.failed);
const totalSpecs = summary.passed + summary.failed;
const playwrightVersion = results.config.version;
const playwrightDuration = dayjs.duration(results.stats.duration, 'millisecond').format('HH:mm:ss');

function generateTitle() {
    let dockerImageLink = '';
    let releaseDate = '';
    if (MM_DOCKER_IMAGE && MM_DOCKER_TAG) {
        dockerImageLink = ` with [${MM_DOCKER_IMAGE}:${MM_DOCKER_TAG}](https://hub.docker.com/r/mattermostdevelopment/${MM_DOCKER_IMAGE}/tags?name=${MM_DOCKER_TAG})`;
    }
    if (RELEASE_DATE) {
        releaseDate = ` for ${RELEASE_DATE}`;
    }

    let title = '';
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

function generateWebhookBody() {
    let testResult;
    const testResults = [
        {status: 'Passed', priority: 'none', cutOff: 100, color: '#43A047'},
        {status: 'Failed', priority: 'low', cutOff: 98, color: '#FFEB3B'},
        {status: 'Failed', priority: 'medium', cutOff: 95, color: '#FF9800'},
        {status: 'Failed', priority: 'high', cutOff: 0, color: '#F44336'},
    ];
    for (let i = 0; i < testResults.length; i++) {
        if (passRate >= testResults[i].cutOff) {
            testResult = testResults[i];
            break;
        }
    }

    const summaryField = `${passRate.toFixed(2)}% (${summary.passed}/${totalSpecs}) | ${playwrightDuration} | playwright@${playwrightVersion}`;
    const serverTypeField = SERVER_TYPE ? '\nTest server: ' + SERVER_TYPE : '';
    const mmEnvField = MM_ENV ? '\nTest server override: ' + MM_ENV : '';
    const rollingReleaseMatchRegex = BUILD_ID?.match(/-rolling(?<version>[^-]+)-/);
    const rollingReleaseFrom = rollingReleaseMatchRegex?.groups?.version;
    const rollingReleaseFromField = rollingReleaseFrom ? `\nRolling release upgrade from: ${rollingReleaseFrom}` : '';
    return {
        username: 'Playwright UI Test',
        icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
        attachments: [
            {
                color: testResult.color,
                author_name: 'Webapp End-to-end Testing (Playwright)',
                author_icon: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
                author_link: 'https://www.mattermost.com',
                title: generateTitle(),
                text: `${summaryField}${serverTypeField}${rollingReleaseFromField}${mmEnvField}`,
            },
        ],
    };
}

let webhookBody = generateWebhookBody();
process.stdout.write(JSON.stringify(webhookBody));
