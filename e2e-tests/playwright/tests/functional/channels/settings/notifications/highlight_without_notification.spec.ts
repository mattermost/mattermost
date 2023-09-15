// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';

test('MM-XX Should add the keyword when enter is pressed on the textbox', async ({
    pw,
    pages,
}) => {
    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    await channelPage.centerView.postCreate.postMessage('Hello World');

    // # Open settings modal
    await channelPage.globalHeader.openSettings();
    await channelPage.accountSettingsModal.toBeVisible();

    // # Open notifications tab
    await channelPage.accountSettingsModal.openNotificationsTab();
});
