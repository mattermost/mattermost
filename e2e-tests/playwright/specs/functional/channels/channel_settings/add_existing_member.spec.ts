// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a user already in a channel is shown as "Already in channel" (not addable) in the
 * add-people modal.
 */
test(
    'MM-T1809 marks an existing channel member as already in channel in the add people modal',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const [member] = await adminClient.createUsers(team.id, 1, 'existing');
        const channel = await adminClient.createPublicChannel(team.id, `Members ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.addToChannel(member.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Open the channel members list and the add-people modal
        const channelMenu = await channelsPage.openChannelMenu();
        await channelMenu.members.click();
        await channelsPage.sidebarRight.toBeVisible();
        await channelsPage.sidebarRight.addMembersButton.click();

        const addModal = channelsPage.getAddPeopleToChannelModal();
        await addModal.toBeVisible();

        // # Search for the member who is already in the channel (the react-select input is auto-focused)
        await addModal.search(member.username);

        // * Verify the member is marked as already in the channel
        await expect(addModal.alreadyInChannelLabel).toBeVisible();
    },
);
