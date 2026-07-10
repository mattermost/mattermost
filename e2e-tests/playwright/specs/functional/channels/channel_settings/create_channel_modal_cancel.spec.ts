// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that cancelling the create-channel modal does not create or join a channel, and that
 * leaving a channel removes it from the sidebar.
 */
test(
    'MM-T861 cancelling the create channel modal does not join a channel',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a new public channel via the modal
        const createdChannel = `Random ${pw.random.id()}`;
        await channelsPage.newChannel(createdChannel, 'O');

        // * Verify the new channel is opened
        await channelsPage.centerView.header.toHaveTitle(createdChannel);

        // # Leave the channel via the channel header menu
        const channelMenu = await channelsPage.openChannelMenu();
        await channelMenu.leaveChannel.click();

        // * Verify the user is redirected to the default channel and the channel is no longer in the sidebar
        await channelsPage.centerView.header.toHaveTitle('Town Square');
        await expect(channelsPage.sidebarLeft.container.getByText(createdChannel)).not.toBeVisible();

        // # Open the create-channel modal, enter a name, and cancel without creating
        const cancelledChannel = `AB ${pw.random.id()}`;
        const newChannelModal = await channelsPage.openNewChannelModal();
        await newChannelModal.displayNameInput.fill(cancelledChannel);
        await newChannelModal.cancel();

        // * Verify the modal is closed and the cancelled channel was never created or joined
        await expect(newChannelModal.container).not.toBeVisible();
        await expect(channelsPage.sidebarLeft.container.getByText(cancelledChannel)).not.toBeVisible();

        // * Verify the previously left channel remains absent from the sidebar
        await expect(channelsPage.sidebarLeft.container.getByText(createdChannel)).not.toBeVisible();
    },
);
