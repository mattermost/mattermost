// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {App, expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Capture visual snapshot of the landing page
 */
test(
    'landing page visual check',
    {tag: ['@visual', '@landing_page', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        // # Go to landing login page
        const app = new App(page);
        await page.goto('/landing#/login');
        await expect(app.linkingLanding.openAppLink).toBeVisible();
        await expect(app.linkingLanding.openBrowserLink).toBeVisible();

        // * Verify landing page appears as expected
        await pw.matchSnapshot(testInfo, {page, browserName, viewport});
    },
);
