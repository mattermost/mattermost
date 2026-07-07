// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify login body card aria-snapshot structure in the dedicated components project
 */
test('aria-snapshot of login body card', {tag: ['@components', '@snapshots']}, async ({pw}) => {
    // # Prevent redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to login page
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Verify aria snapshot of login form container
    await expect(pw.loginPage.bodyCard).toMatchAriaSnapshot();
});
