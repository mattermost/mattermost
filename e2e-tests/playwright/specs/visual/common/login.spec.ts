// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Capture visual snapshots of the login page in normal and error states
 */
test(
    'login page visual check',
    {tag: ['@visual', '@login_page', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        // # Set up the page not to redirect to the landing page
        await pw.hasSeenLandingPage();

        // # Go to login page
        const {adminClient} = await pw.getAdminClient();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // # Click to other element to remove focus from email input
        await pw.loginPage.title.click();

        // # Get license information and prepare test args
        const testArgs = {page, browserName, viewport};
        const license = await adminClient.getClientLicenseOld();
        const editionSuffix = license.IsLicensed === 'true' ? '' : 'team edition';

        // * Verify login page appears as expected
        await pw.matchSnapshot({...testInfo, title: `${testInfo.title} ${editionSuffix}`}, testArgs);

        // # Click sign in button without entering user credential
        await pw.loginPage.signInButton.click();
        await pw.loginPage.userErrorLabel.waitFor();

        // * Verify login page with error appears as expected
        await pw.matchSnapshot({...testInfo, title: `${testInfo.title} error ${editionSuffix}`}, testArgs);
    },
);
