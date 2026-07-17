// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, getRandomId, test} from '@mattermost/playwright-lib';

import {enableMention, openChannel, setup} from './support';

test.describe('LDAP group mentions', () => {
    /**
     * @objective Verify an unlinked LDAP group is neither suggested nor rendered as an active group mention
     */
    test('MM-T2447 excludes an unlinked LDAP group from group mentions', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, boardGroup, regularUser, team} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        await adminClient.unlinkLdapGroup(boardGroup.remote_id);
        const channel = await adminClient.createPublicChannel(team.id, 'Group Mentions');
        await adminClient.addToChannel(regularUser.id, channel.id);
        const channelsPage = await openChannel(pw, regularUser, team.name, channel.name);

        // # Type and post the former group mention after unlinking the LDAP group
        await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
        await expect(channelsPage.centerView.postCreate.suggestionList).not.toBeVisible({timeout: duration.two_sec});
        await channelsPage.postGroupMention(groupName);

        // * Verify the unlinked mention remains plain text
        await channelsPage.assertMentionIsPlainText(groupName);
    });

    /**
     * @objective Verify an enabled LDAP group mention is suggested and linked in a direct message without highlighting
     */
    test('MM-T2460 renders group mentions in direct messages without highlighting', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, boardGroup, regularUser, team} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        const {client: regularClient} = await pw.makeClient(regularUser);
        const directChannel = await regularClient.createDirectChannel([regularUser.id, adminUser.id]);
        const channelsPage = await openChannel(pw, regularUser, team.name, directChannel.name, true);

        // # Suggest and post the group mention in a direct message
        await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
        await channelsPage.centerView.postCreate.toHaveGroupMentionSuggested(groupName);
        await channelsPage.postGroupMention(groupName);

        // * Verify the mention is linked and no membership warning is displayed
        await channelsPage.assertMentionIsLinked(groupName);
        await channelsPage.assertMentionIsNotHighlighted(groupName);
        await channelsPage.assertNoGroupMentionSystemMessage();
    });

    /**
     * @objective Verify an enabled LDAP group mention is suggested and linked in a group message without highlighting
     */
    test('MM-T2461 renders group mentions in group messages without highlighting', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, boardGroup, boardUser, regularUser, team} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        const {client: regularClient} = await pw.makeClient(regularUser);
        const groupChannel = await regularClient.createGroupChannel([regularUser.id, adminUser.id, boardUser.id]);
        const channelsPage = await openChannel(pw, regularUser, team.name, groupChannel.name, true);

        // # Suggest and post the group mention in a group message
        await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
        await channelsPage.centerView.postCreate.toHaveGroupMentionSuggested(groupName);
        await channelsPage.postGroupMention(groupName);

        // * Verify the mention is linked and no membership warning is displayed
        await channelsPage.assertMentionIsLinked(groupName);
        await channelsPage.assertMentionIsNotHighlighted(groupName);
        await channelsPage.assertNoGroupMentionSystemMessage();
    });

    /**
     * @objective Verify a group-constrained channel does not notify members of an unrelated LDAP group
     */
    test('MM-T2443 limits group mentions in a group-synchronized channel', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, boardGroup, boardUser, team} = await setup(pw);
        const developersGroup = await adminClient.getOrLinkLdapGroup('developers');
        const boardGroupName = `board-test-${getRandomId()}`;
        const developersGroupName = `developers-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, boardGroupName);
        await enableMention(adminClient, developersGroup.id, developersGroupName);
        const channel = await adminClient.createPrivateChannel(team.id, 'Group Mentions Synced');
        await adminClient.linkGroupSyncable(boardGroup.id, channel.id, 'channel', {auto_add: true});
        await adminClient.patchChannel(channel.id, {group_constrained: true});
        await adminClient.addToChannel(boardUser.id, channel.id);
        const {user: developer} = await pw.makeClient({username: 'dev.one', password: 'Password1'}, {useCache: false});
        if (!developer) {
            throw new Error('Unable to authenticate LDAP user dev.one');
        }
        await adminClient.addToTeam(team.id, developer.id);
        const channelsPage = await openChannel(pw, boardUser, team.name, channel.name);

        // # Post a mention for a group that is not linked to the constrained channel
        await channelsPage.postGroupMention(developersGroupName);

        // * Verify the post is rendered without an out-of-channel membership prompt
        await channelsPage.assertNoGroupMentionSystemMessage();
    });
});
