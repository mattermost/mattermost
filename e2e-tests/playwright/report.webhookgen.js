// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs.extend(duration);

const {
    TYPE, 
    SERVER_TYPE, 
    BRANCH, 
    PULL_REQUEST, 
    BUILD_ID, 
    MM_ENV, 
    MM_DOCKER_IMAGE, 
    MM_DOCKER_TAG, 
    RELEASE_DATE,
    AWS_S3_BUCKET,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY
} = process.env;

const resultsFile = 'results/reporter/results.json';
const summaryFile = 'results/summary.json';
const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
const passRate = (summary.passed * 100) / (summary.passed + summary.failed);
const totalSpecs = summary.passed + summary.failed;
const playwrightVersion = results.config.version;
const playwrightDuration = dayjs.duration(results.stats.duration, 'millisecond').format('HH:mm:ss');

/**
 * Save artifacts to AWS S3
 * @return {Object} - {reportLink} when successful
 */
async function saveArtifacts() {
    if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
        console.log('Missing AWS S3 environment variables');
        return {success: false};
    }

    const s3 = new AWS.S3({
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    });

    const uploadFile = async (filePath, key) => {
        try {
            const fileContent = fs.readFileSync(filePath);
            const params = {
                Bucket: AWS_S3_BUCKET,
                Key: key,
                Body: fileContent,
                ContentType: path.extname(filePath) === '.html' ? 'text/html' : 'application/json',
            };

            await s3.upload(params).promise();
            return true;
        } catch (error) {
            console.log('Error uploading file:', error);
            return false;
        }
    };

    try {
        // Upload the HTML report and JSON results
        const reportDir = 'results/reporter';
        const reportFiles = fs.readdirSync(reportDir);
        
        const date = new Date();
        const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        const baseS3Folder = `${dateString}/${BUILD_ID || 'unknown'}/playwright`;
        
        // Upload all files in the reporter directory
        for (const file of reportFiles) {
            const filePath = path.join(reportDir, file);
            const key = `${baseS3Folder}/${file}`;
            await uploadFile(filePath, key);
        }
        
        // Upload summary.json
        await uploadFile(summaryFile, `${baseS3Folder}/summary.json`);
        
        // Generate report link to the HTML report
        const reportLink = `https://${AWS_S3_BUCKET}.s3.amazonaws.com/${baseS3Folder}/index.html`;
        console.log('Successfully uploaded artifacts to S3:', reportLink);
        
        return {
            success: true,
            reportLink,
        };
    } catch (error) {
        console.log('Error saving artifacts:', error);
        return {success: false};
    }
}

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

async function generateWebhookBody() {
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

    // Upload artifacts to S3 if environment variables are set
    let reportLinkField = '';
    const artifactResult = await saveArtifacts();
    if (artifactResult && artifactResult.success) {
        reportLinkField = `\nReport: ${artifactResult.reportLink}`;
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
                text: `${summaryField}${serverTypeField}${rollingReleaseFromField}${mmEnvField}${reportLinkField}`,
            },
        ],
    };
}

(async () => {
    const webhookBody = await generateWebhookBody();
    process.stdout.write(JSON.stringify(webhookBody));
})();
