// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Capture visual snapshot of the landing page
 */
test(
    'landing page visual check',
    {tag: ['@visual', '@landing_page', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        // # Go to landing login page
        await pw.landingLoginPage.goto();
        await pw.landingLoginPage.toBeVisible();

        // * Verify landing page appears as expected
        await pw.matchSnapshot(testInfo, {page, browserName, viewport});
    },
);
