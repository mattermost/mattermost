// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test.fixme('Intro to channel as regular user', async ({pw, pages, browserName, viewport}, testInfo) => {
    // Create and sign in a new user
    const {user} = await pw.initSetup();

    // Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // Visit a default channel page
    const channelsPage = new pages.ChannelsPage(page);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // Wait for Playbooks icon to be loaded in App bar, except in iphone
    await expect(channelsPage.appBar.playbooksIcon).toBeVisible();

    // Hide dynamic elements of Channels page
    await pw.hideDynamicChannelsContent(page);

    // Match snapshot of channel intro page
    const testArgs = {page, browserName, viewport};
    await pw.matchSnapshot(testInfo, testArgs);
});
