// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

// No-op: playwright.testcontainers-up.config.ts's globalSetup (the same global_setup.ts the real
// suite uses) already brought the stack up, or reused one already running. This test exists only
// because Playwright's global setup/teardown fire around an actual test run, not standalone.
test('testcontainers stack is up', () => {});
