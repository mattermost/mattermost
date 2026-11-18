// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Post} from '@mattermost/types/posts';

import {Api, type App, expect, settle, test} from '@mattermost/playwright-lib';

/** Opens the User Groups dialog from the product menu. */
async function openUserGroups(app: App) {
    const menu = app.globalHeader.productMenu;
    await menu.container.clickTo(menu.userGroupsMenuItem);
    await menu.userGroupsMenuItem.clickTo(app.userGroupsModal);
}

/** Creates a public channel from the sidebar's browse-or-add menu and waits for it to open. */
async function createChannel(app: App, displayName: string) {
    await app.lhs.header.openBrowseOrAddMenuButton.clickTo(app.lhs.browseOrAddMenu.createChannelMenuItem);
    const modal = await app.lhs.browseOrAddMenu.createChannelMenuItem.clickTo(app.newChannelModal);
    await modal.name.container.fill(displayName);
    const channel = await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
    await expect(app.channelHeader.openMenuButton).toContainText(displayName);
    return channel;
}

/** The channel's "added to the channel" system post, read from the server so its arrival order does not matter. */
async function addedToChannelPost(client: Client4, channelId: string) {
    let found: Post | undefined;
    await expect
        .poll(async () => {
            const {order, posts} = await client.getPosts(channelId);
            found = order.map((id) => posts[id]).find((post) => post.message.includes('added to the channel'));
            return Boolean(found);
        })
        .toBe(true);
    return found as Post;
}

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

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();
    const groups = app.userGroupsModal;

    // # Open the User Groups modal from the product menu
    await openUserGroups(app);

    // # Open the group and archive it
    const groupModal = await groups.group(group).container.clickTo(app.viewUserGroupModal);
    await groupModal.menu.container.clickTo(groupModal.menu.archiveMenuItem);
    await settle(groupModal.menu.archiveMenuItem, {wait: Api.DeleteGroup}).click();

    // # Filter the list to archived groups and open the archived group
    await groups.filterButton.clickTo(groups.filterMenu.archivedMenuItem);
    await groups.filterMenu.archivedMenuItem.click();
    await expect(groups.group(group).container).toBeVisible();
    await groups.group(group).container.clickTo(app.viewUserGroupModal);

    // # Restore the group
    await settle(groupModal.restoreButton, {wait: Api.RestoreGroup}).click();

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

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Create a new channel
    const channelName = `Group Channel ${pw.random.id()}`;
    const channel = await createChannel(app, channelName);

    // # Invite the custom group to the channel with the slash command
    await app.center.postCreate.message.container.fill(`/invite @${groupName} `);
    await settle(app.center.postCreate.sendButton, {wait: Api.ExecuteCommand}).click();

    // * Verify the group's member was added to the channel. The system message and the ephemeral
    // * "already in the channel" reply for the inviter arrive in either order, so don't rely on the last post.
    // The system messages are grouped into one combined post, so the list is read for the text.
    await addedToChannelPost(userClient, channel.id);
    await expect(app.center.postList.container).toContainText(`${member.username} added to the channel`);
});

/**
 * @objective Verify a custom group searched by its mention in the "Add people" dialog lists its members
 * and adds all of them to the channel, even after the User Groups list has been opened.
 */
test('MM-70052 adds every member of a custom group searched by its mention', {tag: '@channels'}, async ({pw}) => {
    const {user, team, userClient, adminClient} = await pw.initSetup();

    // # Create a custom group made up of team members other than the logged in user
    const members = await adminClient.createUsers(team.id, 3, 'member');
    const groupName = `group${pw.random.id()}`.toLowerCase();
    const group = await userClient.createGroupWithUserIds({
        name: groupName,
        display_name: `Group ${pw.random.id()}`,
        source: 'custom',
        allow_reference: true,
        user_ids: members.map((member) => member.id),
    });

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Create a channel that none of the group's members belong to
    const channelName = `Group Channel ${pw.random.id()}`;
    const channel = await createChannel(app, channelName);

    // # Browse the User Groups list, which refreshes the locally cached groups
    await openUserGroups(app);
    await expect(app.userGroupsModal.group(group)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(app.userGroupsModal).not.toBeVisible();

    // # Open the Add people dialog for the channel
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    await app.channelHeader.menu.membersMenuItem.clickTo(app.rhs.channelMembers);
    const addPeopleToChannelModal = await app.rhs.channelMembers.addButton.clickTo(app.channelInviteModal);

    // # Search for the group by its mention
    await addPeopleToChannelModal.users.searchCombobox.fill(`@${groupName}`);

    // * Verify the group is offered with its current member count
    const addGroupMembers = addPeopleToChannelModal.users.results.group(group);
    await expect(addGroupMembers).toContainText(`Add ${members.length} people`);

    // # Hover the "Add N people" shortcut. Its tooltip renders in a portal outside the dialog.
    // The shortcut only shows once its row is hovered, and the tooltip is on the shortcut.
    await addGroupMembers.container.hover();
    await addGroupMembers.addMembersText.hover();

    // * Verify the tooltip names every member of the group
    for (const member of members) {
        await expect(addGroupMembers.tooltip).toContainText(member.username);
    }

    // # Select the whole group and add it to the channel
    // A group option is exposed as a role-free row; choosing it requires its scoped locator.
    await addGroupMembers.container.click();
    await expect(addPeopleToChannelModal.users.remove(members[0].id)).toBeVisible();
    for (const member of members) {
        await expect(addPeopleToChannelModal.users.remove(member.id)).toBeVisible();
    }
    await settle(addPeopleToChannelModal.users.saveButton, {wait: Api.AddChannelMember}).click();

    // * Verify every member of the group joined the channel
    // The system messages are grouped into one combined post, so the list is read for the text.
    await addedToChannelPost(userClient, channel.id);
    await expect(app.center.postList.container).toContainText('added to the channel');
    await expect(app.rhs.container).toContainText(`${members.length + 1} members`);
    for (const member of members) {
        await expect(app.rhs.channelMembers.member(member)).toContainText(member.username);
    }
});
