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

/**
 * @objective Verify existing team members can be added to a public channel and the resulting system post identifies them.
 */
test('MM-T856_1 adds existing users to a public channel from the channel members flow', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [newMember] = await adminClient.createUsers(team.id, 1, 'channel-member');
    const channel = await adminClient.createPublicChannel(team.id, 'Add Existing Members');
    await adminClient.addToChannel(user.id, channel.id);

    // # Open the channel members flow and search for an existing team member
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.members.click();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.addMembersButton.click();
    const addModal = channelsPage.getAddPeopleToChannelModal();
    await addModal.search(newMember.username);

    // * Verify the available user is shown with their status indicator
    await expect(addModal.getUserOption(newMember.username)).toBeVisible();
    await expect(addModal.getUserProfileImage(newMember.username)).toBeVisible();

    // # Select the user and add them to the channel
    await addModal.selectUser(newMember.username);
    await addModal.addSelected();

    // * Verify the system post identifies the newly added user
    await (await channelsPage.getLastPost()).toContainText(`${newMember.username} added to the channel by you`);
});

/**
 * @objective Verify a user who already belongs to a public channel is marked unavailable in the add-people flow.
 */
test('MM-T856_2 prevents adding an existing channel member again', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'Existing Channel Member');
    await adminClient.addToChannel(user.id, channel.id);

    // # Open the add-people dialog and search for the current channel member
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.members.click();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.addMembersButton.click();
    const addModal = channelsPage.getAddPeopleToChannelModal();
    await addModal.search(user.username);

    // * Verify the matching user is labelled as already belonging to the channel
    await expect(addModal.alreadyInChannelLabel).toBeVisible();
});
