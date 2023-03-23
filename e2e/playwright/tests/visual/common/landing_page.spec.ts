// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';

test('/landing#/login', async ({pw, pages, page, isMobile, browserName, viewport}, testInfo) => {
    // Go to landing login page
    const landingLoginPage = new pages.LandingLoginPage(page, isMobile);
    await landingLoginPage.goto();
    await landingLoginPage.toBeVisible();

    // Match snapshot of landing page
    await pw.matchSnapshot(testInfo, {page, browserName, viewport});
});
