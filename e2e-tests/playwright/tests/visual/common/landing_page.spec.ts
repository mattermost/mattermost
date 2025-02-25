// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';

test('/landing#/login', async ({pw, page, browserName, viewport}, testInfo) => {
    // Go to landing login page
    await pw.landingLoginPage.goto();
    await pw.landingLoginPage.toBeVisible();

    // Match snapshot of landing page
    await pw.matchSnapshot(testInfo, {page, browserName, viewport});
});
