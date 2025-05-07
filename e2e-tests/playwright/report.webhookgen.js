// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const {S3} = require('@aws-sdk/client-s3');
const {Upload} = require('@aws-sdk/lib-storage');

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
    AWS_SECRET_ACCESS_KEY,
} = process.env;

const resultsFile = 'results/reporter/results.json';
const summaryFile = 'results/summary.json';
const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
const passRate = (summary.passed * 100) / (summary.passed + summary.failed);
const totalSpecs = summary.passed + summary.failed;
const playwrightVersion = results.config.version;
const playwrightDuration = dayjs.duration(results.stats.duration, 'millisecond').format('HH:mm:ss');
const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new S3({
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

async function uploadFile(filePath, s3Key) {
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    const upload = new Upload({
        client: s3,
        params: {
            Bucket: bucketName,
            Key: s3Key,
            Body: fileStream,
            ContentType: contentType,
        },
    });

    try {
        await upload.done();
        return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error uploading file:', err);
        throw err;
    }
}

/**
 * Recursively upload directory contents to AWS S3
 * @param {string} baseDir - Base directory to walk
 * @param {string} relativeRoot - Root path to preserve relative structure
 */
function walkAndUpload(baseDir, relativeRoot = '') {
    const items = fs.readdirSync(baseDir);

    for (const item of items) {
        const fullPath = path.join(baseDir, item);
        const relPath = path.join(relativeRoot, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            walkAndUpload(fullPath, relPath);
        } else {
            uploadFile(fullPath, relPath);
        }
    }
}

/**
 * Save artifacts to AWS S3
 * @return {Object} - {reportLink} when successful
 */
async function saveArtifacts() {
    if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
        // eslint-disable-next-line no-console
        console.log('Missing AWS S3 environment variables');
        return {success: false};
    }

    const reporterPath = path.join(__dirname, 'results/reporter');
    const reportFiles = fs.readdirSync(reporterPath);

    for (const file of reportFiles) {
        const filePath = path.join(reporterPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            walkAndUpload(filePath, path.join(file)); // preserve directory structure
        } else {
            await uploadFile(filePath, file);
        }
    }

    const reportLink = `https://${AWS_S3_BUCKET}.s3.amazonaws.com/e2e-reports/${BUILD_ID}/index.html`;
    if (process.env.CI) {
        fs.writeFileSync('report-url.txt', reportUrl);
    }
    return {success: true, reportLink};
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
    let summaryField = `${passRate.toFixed(2)}% (${summary.passed}/${totalSpecs}) | ${playwrightDuration} | playwright@${playwrightVersion}`;
    const artifactResult = await saveArtifacts();
    if (artifactResult && artifactResult.success) {
        summaryField += ` | [Report](${artifactResult.reportLink})`;
    }

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

(async () => {
    const webhookBody = await generateWebhookBody();
    process.stdout.write(JSON.stringify(webhookBody));
})();
