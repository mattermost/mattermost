// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as dotenv from 'dotenv';

dotenv.config({quiet: true});

// All process.env should be defined here
export class TestConfig {
    baseURL: string;
    adminUsername: string;
    adminPassword: string;
    adminEmail: string;
    ensurePluginsInstalled: string[];
    haClusterEnabled: boolean;
    haClusterNodeCount: number;
    haClusterName: string;
    pushNotificationServer: string;
    resetBeforeTest: boolean;
    isCI: boolean;
    headless: boolean;
    slowMo: number;
    workers: number;
    snapshotEnabled: boolean;
    percyEnabled: boolean;

    constructor() {
        // Server
        this.baseURL = process.env.PW_BASE_URL || 'http://localhost:8065';
        this.adminUsername = process.env.PW_ADMIN_USERNAME || 'sysadmin';
        this.adminPassword = process.env.PW_ADMIN_PASSWORD || 'Sys@dmin-sample1';
        this.adminEmail = process.env.PW_ADMIN_EMAIL || 'sysadmin@sample.mattermost.com';
        this.ensurePluginsInstalled =
            typeof process.env?.PW_ENSURE_PLUGINS_INSTALLED === 'string'
                ? process.env.PW_ENSURE_PLUGINS_INSTALLED.split(',').filter((plugin) => Boolean(plugin))
                : [];
        this.haClusterEnabled = parseBool(process.env.PW_HA_CLUSTER_ENABLED, false);
        this.haClusterNodeCount = parseNumber(process.env.PW_HA_CLUSTER_NODE_COUNT, 2);
        this.haClusterName = process.env.PW_HA_CLUSTER_NAME || 'mm_dev_cluster';
        this.pushNotificationServer = process.env.PW_PUSH_NOTIFICATION_SERVER || 'https://push-test.mattermost.com';
        this.resetBeforeTest = parseBool(process.env.PW_RESET_BEFORE_TEST, false);
        // CI
        this.isCI = !!process.env.CI;
        // Playwright
        this.headless = parseBool(process.env.PW_HEADLESS, true);
        this.slowMo = parseNumber(process.env.PW_SLOWMO, 0);
        this.workers = parseNumber(process.env.PW_WORKERS, 1);
        // Visual tests
        this.snapshotEnabled = parseBool(process.env.PW_SNAPSHOT_ENABLE, false);
        this.percyEnabled = parseBool(process.env.PW_PERCY_ENABLE, false);
    }
}

// Create a singleton instance
export const testConfig = new TestConfig();

function parseBool(actualValue: string | undefined, defaultValue: boolean) {
    return actualValue ? actualValue === 'true' : defaultValue;
}

function parseNumber(actualValue: string | undefined, defaultValue: number) {
    return actualValue ? parseInt(actualValue, 10) : defaultValue;
}
