// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {SystemConsolePage, duration, expect, getRandomId, test} from '@mattermost/playwright-lib';

import {configureMentionPermissions, enableMention, openChannel, resetMentionPermissions, setup} from './support';

test.describe('LDAP group mentions', () => {
    /**
     * @objective Verify Channel Admin group-mention permission controls suggestions, rendering, and member prompts
     */
    test('MM-T2450 controls Channel Admin group mentions with role permissions', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, boardGroup, boardUser, regularUser, team} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        const {client: regularClient} = await pw.makeClient(regularUser);
        const channel = await regularClient.createPublicChannel(team.id, 'Group Mention Channel Admin');

        try {
            // # Disable group mentions for members and Channel Admins
            await resetMentionPermissions(adminClient);
            await configureMentionPermissions(pw, adminUser, [
                {id: 'all_users-posts-use_group_mentions-checkbox', enabled: false},
                {id: 'channel_admin-posts-use_group_mentions-checkbox', enabled: false},
            ]);
            let channelsPage = await openChannel(pw, regularUser, team.name, channel.name);
            await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
            await expect(channelsPage.centerView.postCreate.suggestionList).not.toBeVisible({
                timeout: duration.two_sec,
            });
            await channelsPage.postGroupMention(groupName);
            await channelsPage.assertMentionIsPlainText(groupName);

            // # Enable group mentions for Channel Admins
            await configureMentionPermissions(pw, adminUser, [
                {id: 'channel_admin-posts-use_group_mentions-checkbox', enabled: true},
            ]);
            channelsPage = await openChannel(pw, regularUser, team.name, channel.name);
            await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
            await channelsPage.centerView.postCreate.toHaveGroupMentionSuggested(groupName);
            await channelsPage.postGroupMention(groupName);

            // * Verify the enabled mention offers to add the out-of-channel group member
            await channelsPage.assertOutOfChannelMentionMessage(boardUser.username, true);
        } finally {
            await resetMentionPermissions(adminClient);
        }
    });

    /**
     * @objective Verify Team Admin group-mention permission controls suggestions, rendering, and no-team-member messages
     */
    test('MM-T2451 controls Team Admin group mentions with role permissions', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, boardGroup, regularUser} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        const {client: regularClient} = await pw.makeClient(regularUser);
        const team = await regularClient.createTeam(await pw.random.team());
        const channel = await regularClient.createPublicChannel(team.id, 'Group Mention Team Admin');

        try {
            // # Disable group mentions for members, Channel Admins, and Team Admins
            await resetMentionPermissions(adminClient);
            await configureMentionPermissions(pw, adminUser, [
                {id: 'all_users-posts-use_group_mentions-checkbox', enabled: false},
                {id: 'channel_admin-posts-use_group_mentions-checkbox', enabled: false},
                {id: 'team_admin-posts-use_group_mentions-checkbox', enabled: false},
            ]);
            let channelsPage = await openChannel(pw, regularUser, team.name, channel.name);
            await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
            await expect(channelsPage.centerView.postCreate.suggestionList).not.toBeVisible({
                timeout: duration.two_sec,
            });
            await channelsPage.postGroupMention(groupName);
            await channelsPage.assertMentionIsPlainText(groupName);

            // # Enable group mentions for Team Admins
            await configureMentionPermissions(pw, adminUser, [
                {id: 'team_admin-posts-use_group_mentions-checkbox', enabled: true},
            ]);
            channelsPage = await openChannel(pw, regularUser, team.name, channel.name);
            await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
            await channelsPage.centerView.postCreate.toHaveGroupMentionSuggested(groupName);
            await channelsPage.postGroupMention(groupName);

            // * Verify the enabled mention reports that the group has no team members
            await channelsPage.assertGroupHasNoTeamMembers(groupName);
            await channelsPage.assertMentionIsLinked(groupName);
            await channelsPage.assertMentionIsNotHighlighted(groupName);
        } finally {
            await resetMentionPermissions(adminClient);
        }
    });

    /**
     * @objective Verify Guest group-mention permission controls suggestions, rendering, and invitation availability
     */
    test('MM-T2452 controls Guest group mentions with role permissions', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, boardGroup, boardUser, team} = await setup(pw);
        await adminClient.patchConfig({GuestAccountsSettings: {Enable: true}});
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        const channel = await adminClient.createPublicChannel(team.id, 'Group Mention Guest');
        const randomGuest = await pw.random.user();
        const guest = {
            ...(await adminClient.createUser(randomGuest, '', '')),
            password: randomGuest.password,
        } as UserProfile;
        await adminClient.addToTeam(team.id, guest.id);
        await adminClient.addToChannel(guest.id, channel.id);
        await adminClient.demoteUserToGuest(guest.id);

        try {
            // # Verify member and Guest group mentions are disabled
            await resetMentionPermissions(adminClient);
            const {page} = await pw.testBrowser.login(adminUser);
            const consolePage = new SystemConsolePage(page);
            await consolePage.permissionsSystemScheme.goto();
            await consolePage.permissionsSystemScheme.setGroupMentionPermissions([
                {id: 'all_users-posts-use_group_mentions-checkbox', enabled: false},
                {id: 'guests-guest_use_group_mentions-checkbox', enabled: false},
            ]);
            await consolePage.permissionsSystemScheme.expectGroupMentionPermissionsDisabled(
                'all_users-posts-use_group_mentions-checkbox',
                'guests-guest_use_group_mentions-checkbox',
            );
            let channelsPage = await openChannel(pw, guest, team.name, channel.name);
            await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
            await expect(channelsPage.centerView.postCreate.suggestionList).not.toBeVisible({
                timeout: duration.two_sec,
            });
            await channelsPage.postGroupMention(groupName);
            await channelsPage.assertMentionIsPlainText(groupName);

            // # Enable group mentions for Guests
            await configureMentionPermissions(pw, adminUser, [
                {id: 'guests-guest_use_group_mentions-checkbox', enabled: true},
            ]);
            channelsPage = await openChannel(pw, guest, team.name, channel.name);
            await channelsPage.centerView.postCreate.writeMessage(`@${groupName}`);
            await channelsPage.centerView.postCreate.toHaveGroupMentionSuggested(groupName);
            await channelsPage.postGroupMention(groupName);

            // * Verify the Guest sees the warning without an option to invite the group member
            await channelsPage.assertOutOfChannelMentionMessage(boardUser.username, false);
        } finally {
            await resetMentionPermissions(adminClient);
        }
    });
});
