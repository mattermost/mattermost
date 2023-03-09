// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from 'cypress';

export default defineConfig({
    chromeWebSecurity: false,
    defaultCommandTimeout: 20000,
    downloadsFolder: 'tests/downloads',
    fixturesFolder: 'tests/fixtures',
    numTestsKeptInMemory: 0,
    screenshotsFolder: 'tests/screenshots',
    taskTimeout: 20000,
    video: false,
    viewportWidth: 1300,
    env: {
        adminEmail: 'sysadmin@sample.mattermost.com',
        adminUsername: 'sysadmin',
        adminPassword: 'Sys@dmin-sample1',
        allowedUntrustedInternalConnections: 'localhost',
        cwsURL: 'http://localhost:8076',
        cwsAPIURL: 'http://localhost:8076',
        dbClient: 'postgres',
        dbConnection: 'postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable&connect_timeout=10',
        elasticsearchConnectionURL: 'http://localhost:9200',
        firstTest: false,
        keycloakAppName: 'mattermost',
        keycloakBaseUrl: 'http://localhost:8484',
        keycloakUsername: 'mmuser',
        keycloakPassword: 'mostest',
        ldapServer: 'localhost',
        ldapPort: 389,
        minioAccessKey: 'minioaccesskey',
        minioSecretKey: 'miniosecretkey',
        minioS3Bucket: 'mattermost-test',
        minioS3Endpoint: 'localhost:9000',
        minioS3SSL: false,
        numberOfTrialUsers: 100,
        resetBeforeTest: false,
        runLDAPSync: true,
        secondServerURL: 'http://localhost/s/p',
        serverEdition: 'Team',
        serverClusterEnabled: false,
        serverClusterName: 'mm_dev_cluster',
        serverClusterHostCount: 3,
        smtpUrl: 'http://localhost:9001',
        webhookBaseUrl: 'http://localhost:3000',
    },
    e2e: {
        setupNodeEvents(on, config) {
            return require('./tests/plugins/index.js')(on, config); // eslint-disable-line global-require
        },
        baseUrl: process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065',
        excludeSpecPattern: '**/node_modules/**/*',
        specPattern: 'tests/integration/**/*_spec.{js,ts}',
        supportFile: 'tests/support/index.js',
        testIsolation: false,
    },
});
