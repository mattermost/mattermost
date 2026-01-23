// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const fs = require('fs');

const clientRequest = require('./client_request');
const {
    dbGetActiveUserSessions,
    dbGetUser,
    dbGetUserSession,
    dbUpdateUserSession,
    dbRefreshPostStats,
} = require('./db_request');
const externalRequest = require('./external_request').default;
const {fileExist, writeToFile} = require('./file_util');
const getPdfContent = require('./get_pdf_content');
const getRecentEmail = require('./get_recent_email');
const keycloakRequest = require('./keycloak_request');
const oktaRequest = require('./okta_request');
const postBotMessage = require('./post_bot_message');
const postIncomingWebhook = require('./post_incoming_webhook');
const postMessageAs = require('./post_message_as');
const postListOfMessages = require('./post_list_of_messages');
const reactToMessageAs = require('./react_to_message_as');
const {
    shellFind,
    shellRm,
    shellUnzip,
} = require('./shell');
const urlHealthCheck = require('./url_health_check');

const log = (message) => {
    console.log(message);
    return null;
};

module.exports = (on, config) => {
    on('task', {
        clientRequest,
        dbGetActiveUserSessions,
        dbGetUser,
        dbGetUserSession,
        dbUpdateUserSession,
        dbRefreshPostStats,
        externalRequest,
        fileExist,
        writeToFile,
        getPdfContent,
        getRecentEmail,
        keycloakRequest,
        log,
        oktaRequest,
        postBotMessage,
        postIncomingWebhook,
        postMessageAs,
        postListOfMessages,
        urlHealthCheck,
        reactToMessageAs,
        shellFind,
        shellRm,
        shellUnzip,
    });

    on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.name === 'chrome' && !config.chromeWebSecurity) {
            launchOptions.args.push('--disable-features=CrossSiteDocumentBlockingIfIsolating,CrossSiteDocumentBlockingAlways,IsolateOrigins,site-per-process');
            launchOptions.args.push('--load-extension=tests/extensions/Ignore-X-Frame-headers');
        }

        if (browser.family === 'chromium' && browser.name !== 'electron') {
            launchOptions.args.push('--disable-dev-shm-usage');
        }

        return launchOptions;
    });

    // https://docs.cypress.io/guides/guides/screenshots-and-videos#Delete-videos-for-specs-without-failing-or-retried-tests
    on('after:spec', (spec, results) => {
        if (results && results.video) {
            // Do we have failures for any retry attempts?
            const failures = results.tests.some((test) =>
                test.attempts.some((attempt) => attempt.state === 'failed'),
            );
            if (!failures) {
                // delete the video if the spec passed and no tests retried
                fs.unlinkSync(results.video);
            }
        }
    });

    return config;
};
