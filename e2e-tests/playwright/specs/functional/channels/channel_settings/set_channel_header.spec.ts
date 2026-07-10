// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a channel header can be added from the "Set header" link in a new channel's intro,
 * that cancelling the modal makes no change, and that the saved header appears in the channel info.
 */
test('MM-T880 adds a channel header from the intro Set header link', {tag: '@channel_settings'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Create a new public channel so its intro (with the "Set header" link) is shown
    const channelName = `channel header ${pw.random.id()}`;
    await channelsPage.newChannel(channelName, 'O');
    await channelsPage.centerView.header.toHaveTitle(channelName);

    // # Open the Edit Header modal from the intro and cancel without entering text
    await channelsPage.centerView.channelIntro.getByRole('button', {name: 'Set header'}).click();
    await channelsPage.editChannelHeaderModal.toBeVisible();
    await channelsPage.editChannelHeaderModal.cancel();

    // # Reopen the Edit Header modal and save a header
    const header = 'this is the channel header';
    await channelsPage.centerView.channelIntro.getByRole('button', {name: 'Set header'}).click();
    await channelsPage.editChannelHeaderModal.toBeVisible();
    await channelsPage.editChannelHeaderModal.setHeader(header);

    // * Verify the header-change system message is posted
    await channelsPage.centerView.waitUntilLastPostContains(`updated the channel header to: ${header}`);

    // # Open the channel info panel from the channel header menu
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.viewInfo.click();
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify the saved header appears in the channel info panel
    await expect(channelsPage.sidebarRight.container.getByText(header)).toBeVisible();
});
