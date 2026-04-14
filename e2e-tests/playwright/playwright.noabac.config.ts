// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';

import baseConfig from './playwright.config';

// Config variant that excludes ABAC specs, used by the playwright-full CI job.
// ABAC tests run in a dedicated playwright-abac CI job to prevent their slow
// LDAP sync waits (~60s each) from clustering in a single shard and blowing
// the shard timeout.
export default defineConfig({
    ...baseConfig,
    testIgnore: ['**/system_console/abac/**'],
});
