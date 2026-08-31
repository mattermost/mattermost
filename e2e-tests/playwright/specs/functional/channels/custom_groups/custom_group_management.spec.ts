// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a custom user group can be archived, viewed under the archived filter, and restored.
 */
test('MM-T5584 views and unarchives a custom group', {tag: '@channels'}, async ({pw}) => {
    const {user, team, userClient} = await pw.initSetup();

    // # Create a custom group owned by the user
    const groupName = `group${pw.random.id()}`.toLowerCase();
    const group = await userClient.createGroupWithUserIds({
        name: groupName,
        display_name: `Testing Group ${pw.random.id()}`,
        source: 'custom',
        allow_reference: true,
        user_ids: [user.id],
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const groupModal = channelsPage.getViewUserGroupModal(group.display_name);

    // # Open the User Groups modal from the product menu
    await channelsPage.globalHeader.openUserGroups();
    await channelsPage.userGroupsModal.toBeVisible();

    // # Open the group and archive it
    await channelsPage.userGroupsModal.openGroup(group.display_name);
    await groupModal.archive();

    // # Filter the list to archived groups and open the archived group
    await channelsPage.userGroupsModal.filterArchived();
    await channelsPage.userGroupsModal.openGroup(group.display_name);

    // # Restore the group
    await groupModal.restore();

    // * Verify the group is restored (member management is available again)
    await expect(groupModal.addPeopleButton).toBeVisible();
});

/**
 * @objective Verify a custom user group can be invited to a channel with the /invite slash command, adding
 * the group's members to the channel.
 */
test('MM-T5598 invites a custom group to a channel', {tag: '@channels'}, async ({pw}) => {
    const {user, team, userClient, adminClient} = await pw.initSetup();

    // # Create a second team member and a custom group containing both users
    const [member] = await adminClient.createUsers(team.id, 1, 'member');
    const groupName = `group${pw.random.id()}`.toLowerCase();
    await userClient.createGroupWithUserIds({
        name: groupName,
        display_name: `Group ${pw.random.id()}`,
        source: 'custom',
        allow_reference: true,
        user_ids: [user.id, member.id],
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Create a new channel
    const channelName = `Group Channel ${pw.random.id()}`;
    await channelsPage.newChannel(channelName, 'O');
    await channelsPage.centerView.header.toHaveTitle(channelName);

    // # Invite the custom group to the channel with the slash command
    await channelsPage.centerView.postCreate.writeMessage(`/invite @${groupName} `);
    await channelsPage.centerView.postCreate.sendMessage();

    // * Verify the group's member was added to the channel
    await channelsPage.centerView.waitUntilLastPostContains('added to the channel');
    await channelsPage.centerView.waitUntilLastPostContains(member.username);
});
