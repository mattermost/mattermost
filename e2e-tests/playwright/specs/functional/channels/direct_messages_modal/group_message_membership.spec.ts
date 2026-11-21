// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {goToChannel, selectUser} from './dm_dialog';

/**
 * @objective Verify adding a member to an existing group message starts a new conversation with every selected member and no message history.
 */
test('MM-T468 Group Messaging: Add member to existing GM', {tag: '@direct_messages'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const members = await adminClient.createUsers(team.id, 3, 'gm-member');
    const [newMember] = await adminClient.createUsers(team.id, 1, 'gm-new-member');
    const groupChannel = await adminClient.createGroupChannel([user.id, ...members.map((member) => member.id)]);

    // # Open the existing group message and add historical messages
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: groupChannel.name});
    await expect(app.center.postCreate).toBeVisible();
    for (const message of ['some', 'historical', 'messages']) {
        await app.center.postCreate.message.container.fill(message);
        await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    }

    // # Open the channel member list and choose to add a member
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    await app.channelHeader.menu.membersMenuItem.clickTo(app.rhs.channelMembers);
    const modal = await app.rhs.channelMembers.addButton.clickTo(app.directMessagesModal);

    // * Verify the new-conversation warning and all existing members are selected
    await expect(modal.options.noteText).toContainText(
        "This will start a new conversation. If you're adding a lot of people, consider creating a private channel instead.",
    );
    for (const member of members) {
        await expect(modal.options.remove(member.id)).toBeVisible();
    }

    // # Select another member and create the new group message
    await selectUser(app, newMember);
    await goToChannel(app);

    // * Verify the historical messages are absent and the new group message intro is shown
    await expect(app.center.postList.channelIntro).toContainText(
        'This is the start of your group message history with',
    );
    await expect(app.center.postList.container).not.toContainText('historical');
    await expect(app.channelHeader.openMenuButton).toContainText(newMember.username);

    // # Open the group message member list
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    // The members panel can already be open from adding the member, so the item is clicked and the panel asserted.
    await app.channelHeader.menu.membersMenuItem.click();
    await expect(app.rhs.channelMembers).toBeVisible();

    // * Verify the new member and every original member remain in the conversation
    for (const member of [...members, newMember]) {
        await expect(app.rhs.channelMembers.member(member)).toContainText(member.username);
    }
});
