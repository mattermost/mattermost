// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

test('MM-12345 Should show channel banner when configured', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'premium', 'Skipping test - server does not have Premium license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.globalHeader.openChannelSettings();
})
