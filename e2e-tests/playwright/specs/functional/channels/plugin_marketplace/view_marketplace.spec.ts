// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a system admin can open and close the plugin (App) Marketplace.
 *
 * MM-T1946 and MM-T1947 cover the same behavior as MM-T1945 and are covered by this test.
 */
test('MM-T1945 MM-T1946 MM-T1947 system admin can view the plugin marketplace', {tag: '@marketplace'}, async ({pw}) => {
    const {adminUser, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the App Marketplace from the product menu
    await channelsPage.globalHeader.openAppMarketplace();

    // * Verify the Marketplace is shown
    const marketplace = channelsPage.marketplaceModal;
    await marketplace.toBeVisible();

    // # Close the Marketplace
    await marketplace.close();

    // * Verify the Marketplace is closed
    await marketplace.notToBeVisible();
});
