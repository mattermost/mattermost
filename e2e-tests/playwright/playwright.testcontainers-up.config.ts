// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';

// Standalone config for `npm run testcontainers:up`: brings up (or reuses) the Testcontainers
// stack via its own global setup — deliberately not the real suite's global_setup.ts, so the
// server comes up fresh and untouched by baseGlobalSetup()'s admin/sysadmin bootstrap. Runs a
// single no-op test so Playwright has something to execute global setup/teardown around, without
// pulling in the main playwright.config.ts's projects/browsers or touching its `specs` testDir.
export default defineConfig({
    globalSetup: './script/testcontainers_up_global_setup.ts',
    testDir: './script',
    testMatch: /testcontainers_up\.spec\.ts/,
});
