// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

/*
 * This is used for saving artifacts to AWS S3, sending data to automation dashboard and
 * publishing quick summary to community channels.
 *
 * Usage: [ENV] node save_report.js
 *
 * Environment variables:
 *   BRANCH=[branch]            : Branch identifier from CI
 *   BUILD_ID=[build_id]        : Build identifier from CI
 *   BUILD_TAG=[build_tag]      : Docker image used to run the test
 *
 *   For saving artifacts to AWS S3
 *      - AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
 *   For saving test cases to Test Management
 *      - TM4J_ENABLE=true|false
 *      - TM4J_API_KEY=[api_key]
 *      - JIRA_PROJECT_KEY=[project_key], e.g. "MM",
 *      - TM4J_FOLDER_ID=[folder_id], e.g. 847997
 *   For sending hooks to Mattermost channels
 *      - FULL_REPORT, WEBHOOK_URL and DIAGNOSTIC_WEBHOOK_URL
 *      - If AUTOMATION_DASHBOARD_FRONTEND_URL is set, a link to the corresponding cycle will be included in the report message
 *   Test type
 *      - TYPE=[type]; valid values: "PR", "RELEASE", "MASTER", "MASTER_UNSTABLE", "CLOUD", "CLOUD_UNSTABLE", "NONE"
 *   Server type
 *      - SERVER_TYPE=[type]; used for the 'Test Server' field in the webhook. Any string representing the server type is valid, common values are "onprem" and "cloud"
 */

const {merge} = require('mochawesome-merge');
const generator = require('mochawesome-report-generator');

const {
    generateDiagnosticReport,
    generateShortSummary,
    generateTestReport,
    removeOldGeneratedReports,
    sendReport,
    readJsonFromFile,
    writeJsonToFile,
} = require('./utils/report');
const {saveArtifacts} = require('./utils/artifacts');
const {MOCHAWESOME_REPORT_DIR, RESULTS_DIR} = require('./utils/constants');
const {createTestCycle, createTestExecutions} = require('./utils/test_cases');

require('dotenv').config();

const saveReport = async () => {
    const {
        BRANCH,
        BUILD_ID,
        BUILD_TAG,
        DIAGNOSTIC_WEBHOOK_URL,
        DIAGNOSTIC_USER_ID,
        DIAGNOSTIC_TEAM_ID,
        TM4J_ENABLE,
        TM4J_CYCLE_KEY,
        TYPE,
        WEBHOOK_URL,
    } = process.env;

    removeOldGeneratedReports();

    // Merge all json reports into one single json report
    const jsonReport = await merge({files: [`${MOCHAWESOME_REPORT_DIR}/**/*.json`]});
    writeJsonToFile(jsonReport, 'all.json', MOCHAWESOME_REPORT_DIR);

    // Generate the html report file
    await generator.create(
        jsonReport,
        {
            reportDir: MOCHAWESOME_REPORT_DIR,
            reportTitle: `Build:${BUILD_ID} Branch: ${BRANCH} Tag: ${BUILD_TAG}`,
        },
    );

    // Generate short summary, write to file and then send report via webhook
    const summary = generateShortSummary(jsonReport);
    console.log(summary);
    writeJsonToFile(summary, 'summary.json', MOCHAWESOME_REPORT_DIR);

    const result = await saveArtifacts();
    if (result && result.success) {
        console.log('Successfully uploaded artifacts to S3:', result.reportLink);
    }

    // Create or use an existing test cycle
    let testCycle = {};
    if (TM4J_ENABLE === 'true') {
        const {start, end} = jsonReport.stats;
        testCycle = TM4J_CYCLE_KEY ? {key: TM4J_CYCLE_KEY} : await createTestCycle(start, end);
    }

    // Send test report to "QA: UI Test Automation" channel via webhook
    if (TYPE && TYPE !== 'NONE' && WEBHOOK_URL) {
        const environment = readJsonFromFile(`${RESULTS_DIR}/environment.json`);
        const data = generateTestReport(summary, result && result.success, result && result.reportLink, environment, testCycle.key);
        await sendReport('summary report to Community channel', WEBHOOK_URL, data);
    }

    // Send diagnostic report via webhook
    // Send on "RELEASE" type only
    if (TYPE === 'RELEASE' && DIAGNOSTIC_WEBHOOK_URL && DIAGNOSTIC_USER_ID && DIAGNOSTIC_TEAM_ID) {
        const data = generateDiagnosticReport(summary, {userId: DIAGNOSTIC_USER_ID, teamId: DIAGNOSTIC_TEAM_ID});
        await sendReport('test info for diagnostic analysis', DIAGNOSTIC_WEBHOOK_URL, data);
    }

    // Save test cases to Test Management
    if (TM4J_ENABLE === 'true') {
        await createTestExecutions(jsonReport, testCycle);
    }
};

saveReport();
