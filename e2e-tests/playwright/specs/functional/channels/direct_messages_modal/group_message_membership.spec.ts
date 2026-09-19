// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify adding a member to an existing group message starts a new conversation with every selected member and no message history.
 */
test('MM-T468 Group Messaging: Add member to existing GM', {tag: '@direct_messages'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const members = await adminClient.createUsers(team.id, 3, 'gm-member');
    const [newMember] = await adminClient.createUsers(team.id, 1, 'gm-new-member');
    const groupChannel = await adminClient.createGroupChannel([user.id, ...members.map((member) => member.id)]);

    // # Open the existing group message and add historical messages
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, groupChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('some');
    await channelsPage.postMessage('historical');
    await channelsPage.postMessage('messages');

    // # Open the channel member list and choose to add a member
    await channelsPage.centerView.header.openChannelMenu();
    await channelsPage.channelMenu.members.click();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.addMembersButton.click();
    const modal = channelsPage.directChannelsModal;
    await modal.toBeVisible();

    // * Verify the new-conversation warning and all existing members are selected
    await expect(modal.newConversationWarning).toBeVisible();
    for (const member of members) {
        await expect(modal.getRemoveButton(member.username)).toBeVisible();
    }

    // # Select another member and create the new group message
    await modal.selectUser(newMember);
    await modal.goToChannel();

    // * Verify the historical messages are absent and the new group message intro is shown
    await channelsPage.toNotContainText('historical');
    await expect(channelsPage.centerView.channelIntro).toContainText(
        'This is the start of your group message history with',
    );
    await channelsPage.centerView.header.toHaveTitle(newMember.username);

    // # Open the group message member list
    await channelsPage.centerView.header.openChannelMenu();
    await channelsPage.channelMenu.members.click();
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify the new member and every original member remain in the conversation
    for (const member of [...members, newMember]) {
        await channelsPage.sidebarRight.toContainText(member.username);
    }
});
