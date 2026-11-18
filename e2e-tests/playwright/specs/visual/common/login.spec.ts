// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {App, expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Capture visual snapshots of the login page in normal and error states
 */
test(
    'login page visual check',
    {tag: ['@visual', '@login_page', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        const app = new App(page);
        // # Set up the page not to redirect to the landing page
        await pw.hasSeenLandingPage();

        // # Go to login page
        const {adminClient} = await pw.getAdminClient();
        await app.loginPage.goto();
        await expect(app.login.loginId.container).toBeVisible();
        await expect(app.login.password.container).toBeVisible();

        // # Click to other element to remove focus from email input
        await app.login.titleText.click();
        await expect(app.login.loginId.container).not.toBeFocused();

        // # Get license information and prepare test args
        const testArgs = {page, browserName, viewport};
        const license = await adminClient.getClientLicenseOld();
        const editionSuffix = license.IsLicensed === 'true' ? '' : 'team edition';

        // * Verify login page appears as expected
        await pw.matchSnapshot({...testInfo, title: `${testInfo.title} ${editionSuffix}`}, testArgs);

        // # Click sign in button without entering user credential
        await app.login.card.logInButton.click();
        // The empty-credentials error shows in the banner above the form.
        await expect(app.login.banner.container).toBeVisible();

        // * Verify login page with error appears as expected
        await pw.matchSnapshot({...testInfo, title: `${testInfo.title} error ${editionSuffix}`}, testArgs);
    },
);
