// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, Msg, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a user already in a channel is shown as "Already in channel" (not addable) in the
 * add-people modal.
 */
test(
    'MM-T1809 marks an existing channel member as already in channel in the add people modal',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const [member, outsider] = await adminClient.createUsers(team.id, 2, 'existing');
        const channel = await adminClient.createPublicChannel(team.id, `Members ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.addToChannel(member.id, channel.id);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});
        await expect(app.center.postList).toBeVisible();

        // # Open the channel members panel and its add-people modal
        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
        const menu = app.channelHeader.menu;
        await menu.membersMenuItem.clickTo(app.rhs.channelMembers);
        await app.rhs.channelMembers.addButton.clickTo(app.channelInviteModal);
        const people = app.channelInviteModal.users;

        // # Search for the member who is already in the channel (the search box is focused on open)
        await people.searchCombobox.fill(member.username);

        // * The member's row says they are already in the channel
        await expect(people.results.user(member).membershipText).toHaveMessage(Msg.channel_invite.already_member._);

        // # Search for a team member who isn't in the channel
        await people.searchCombobox.fill(outsider.username);

        // * Their row carries no membership note
        await expect(people.results.user(outsider)).toBeVisible();
        await expect(people.results.user(outsider).membershipText).toHaveText('');
    },
);

/**
 * @objective Verify that a team member picked in the add-people modal is added to the channel on saving.
 */
test('adds a team member to the channel from the add people modal', {tag: '@channel_settings'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [newcomer] = await adminClient.createUsers(team.id, 1, 'newcomer');
    const channel = await adminClient.createPublicChannel(team.id, `Members ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    await expect(app.center.postList).toBeVisible();

    // # Open the add-people modal from the channel's sidebar menu, then pick the newcomer
    const row = app.lhs.channelList.channel(channel);
    await row.container.hover();
    await row.openMenuButton.clickTo(app.lhs.channelMenu.addMembersMenuItem);
    await app.lhs.channelMenu.addMembersMenuItem.clickTo(app.channelInviteModal);
    const invite = app.channelInviteModal;
    await invite.users.searchCombobox.fill(newcomer.username);
    // The selectable row has no clickable role, so retain the exact row click.
    await invite.users.results.user(newcomer).locator.click();

    // * The newcomer is selected, with a chip to remove them again
    await expect(invite.users.removeList).toHaveKeys([newcomer.id]);

    // # Add them
    await settle(invite.users.saveButton, {wait: Api.AddChannelMember}).click();

    // * The modal closes and the server lists the newcomer as a channel member
    await expect(invite).not.toBeVisible();
    await expect
        .poll(async () => (await adminClient.getChannelMembers(channel.id)).map((m) => m.user_id))
        .toContain(newcomer.id);
});
