// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@mattermost/testcontainers';

/**
 * Testcontainers configuration for Playwright E2E tests.
 *
 * Configuration priority (highest to lowest):
 * 1. CLI flags (e.g., -e, -t, --ha)
 * 2. Environment variables (e.g., TC_EDITION, MM_SERVICEENVIRONMENT)
 * 3. This config file
 * 4. Built-in defaults
 *
 * @see https://github.com/mattermost/mattermost/tree/master/e2e-tests/testcontainers
 */
export default defineConfig({
    // Mattermost server configuration
    server: {
        // edition: 'enterprise', // 'enterprise', 'fips', or 'team' (@env TC_EDITION, @default 'enterprise')
        // entry: false, // Entry tier mode, enterprise/fips only (@env TC_ENTRY, @default false)
        // tag: 'master', // e.g., 'master', 'release-11.4' (@env TC_SERVER_TAG, @default 'master')
        // serviceEnvironment: 'test', // 'test', 'production', or 'dev' (@env MM_SERVICEENVIRONMENT, @default 'test')
        // imageMaxAgeHours: 24, // Pull fresh images if older than N hours (@env TC_IMAGE_MAX_AGE_HOURS, @default 24)
        // ha: false, // High-availability mode (3-node cluster with nginx) - requires MM_LICENSE (@env TC_HA, @default false)
        // subpath: false, // Subpath mode (2 servers at /mattermost1 and /mattermost2) (@env TC_SUBPATH, @default false)
        // env: {
        //     MM_SERVICESETTINGS_ENABLEOPENSERVER: 'true',
        //     MM_LOGSETTINGS_CONSOLELEVEL: 'DEBUG',
        // },
        // config: {
        //     ServiceSettings: {EnableOpenServer: true, EnableTesting: true},
        //     TeamSettings: {MaxUsersPerTeam: 100},
        // },
    },

    // Dependencies to start with the test environment
    // Optional: 'openldap', 'keycloak', 'minio', 'redis', 'opensearch' or 'elasticsearch'
    // @env TC_DEPENDENCIES (comma-separated)
    // @default ['postgres', 'inbucket']
    // dependencies: ['postgres', 'inbucket', 'openldap', 'keycloak', 'minio', 'redis', 'opensearch'],

    // Output directory for all testcontainers artifacts (logs/, .env.tc, .tc.docker.json, etc.)
    // @default '.tc.out'
    // @env TC_OUTPUT_DIR
    // outputDir: '.tc.out',

    // Admin user configuration (creates admin user after server starts)
    // Email is derived as '<username>@sample.mattermost.com'
    // @env TC_ADMIN_USERNAME, TC_ADMIN_PASSWORD
    // admin: {
    //     username: 'sysadmin',
    //     password: 'Sys@dmin-sample1',
    // },

    // Container images for supporting services (uncomment to override defaults)
    // Each can be overridden via TC_<SERVICE>_IMAGE environment variable
    // images: {
    //     postgres: 'postgres:14',
    //     inbucket: 'inbucket/inbucket:stable',
    //     openldap: 'osixia/openldap:1.4.0',
    //     keycloak: 'quay.io/keycloak/keycloak:23.0.7',
    //     minio: 'minio/minio:RELEASE.2024-06-22T05-26-45Z',
    //     elasticsearch: 'mattermostdevelopment/mattermost-elasticsearch:8.9.0',
    //     opensearch: 'mattermostdevelopment/mattermost-opensearch:2.7.0',
    //     redis: 'redis:7.4.0',
    //     dejavu: 'appbaseio/dejavu:3.4.2',
    //     prometheus: 'prom/prometheus:v2.46.0',
    //     grafana: 'grafana/grafana:10.4.2',
    //     loki: 'grafana/loki:3.0.0',
    //     promtail: 'grafana/promtail:3.0.0',
    //     nginx: 'nginx:1.29.4',
    // },
});
