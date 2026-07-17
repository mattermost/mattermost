// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {getRandomId, test} from '@mattermost/playwright-lib';

import {enableMention, openChannel, resetMentionPermissions, setup} from './support';

test.describe('LDAP group mentions', () => {
    /**
     * @objective Verify a member can invite an LDAP group member who belongs to the team but not the channel
     */
    test(
        'MM-T2456 offers to add group members who are in the team but not the channel',
        {tag: '@ldap'},
        async ({pw}) => {
            const {adminClient, boardGroup, boardUser, regularUser, team} = await setup(pw);
            const groupName = `board-test-${getRandomId()}`;
            await enableMention(adminClient, boardGroup.id, groupName);
            const {client: regularClient} = await pw.makeClient(regularUser);
            const channel = await regularClient.createPublicChannel(team.id, 'Group Mention Team Member');
            const channelsPage = await openChannel(pw, regularUser, team.name, channel.name);

            // # Mention the group whose member is outside the channel
            await channelsPage.postGroupMention(groupName);

            // * Verify the member warning includes an option to add them to the channel
            await channelsPage.assertOutOfChannelMentionMessage(boardUser.username, true);
        },
    );

    /**
     * @objective Verify mentioning an LDAP group with no members on the current team reports that condition
     */
    test('MM-T2457 reports when a mentioned group has no members on the team', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, boardGroup} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        const team = await adminClient.createTeam(await pw.random.team());
        const randomUser = await pw.random.user();
        const user = {
            ...(await adminClient.createUser(randomUser, '', '')),
            password: randomUser.password,
        } as UserProfile;
        await adminClient.addToTeam(team.id, user.id);
        const channel = await adminClient.createPublicChannel(team.id, 'Group Mention No Team Members');
        await adminClient.addToChannel(user.id, channel.id);
        const channelsPage = await openChannel(pw, user, team.name, channel.name);

        // # Mention the LDAP group from a team with no group members
        await channelsPage.postGroupMention(groupName);

        // * Verify the no-team-members message and non-highlighted rendering
        await channelsPage.assertGroupHasNoTeamMembers(groupName);
        await channelsPage.assertMentionIsLinked(groupName);
        await channelsPage.assertMentionIsNotHighlighted(groupName);
    });

    /**
     * @objective Verify Guests cannot invite out-of-channel LDAP group members from a group mention warning
     */
    test('MM-T2458 hides the add-member option from Guests using group mentions', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, boardGroup, boardUser, team} = await setup(pw);
        await adminClient.patchConfig({GuestAccountsSettings: {Enable: true}});
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        const channel = await adminClient.createPublicChannel(team.id, 'Group Mention Guest Warning');
        const randomGuest = await pw.random.user();
        const guest = {
            ...(await adminClient.createUser(randomGuest, '', '')),
            password: randomGuest.password,
        } as UserProfile;
        await adminClient.addToTeam(team.id, guest.id);
        await adminClient.addToChannel(guest.id, channel.id);
        await adminClient.demoteUserToGuest(guest.id);

        try {
            await resetMentionPermissions(adminClient);
            const channelsPage = await openChannel(pw, guest, team.name, channel.name);

            // # Mention the group as a Guest
            await channelsPage.postGroupMention(groupName);

            // * Verify the warning is shown without an add-member link
            await channelsPage.assertOutOfChannelMentionMessage(boardUser.username, false);
        } finally {
            await resetMentionPermissions(adminClient);
        }
    });

    /**
     * @objective Verify users without Manage Members permission cannot invite out-of-channel LDAP group members
     */
    test('MM-T2459 hides the add-member option when Manage Members is disabled', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, boardGroup, boardUser, regularUser, team} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;
        await enableMention(adminClient, boardGroup.id, groupName);
        const channel = await adminClient.createPublicChannel(team.id, 'Group Mention No Manage Members');
        await adminClient.addToChannel(regularUser.id, channel.id);
        const [channelUserRole] = await adminClient.getRolesByNames(['channel_user']);
        const originalPermissions = channelUserRole.permissions;

        try {
            await adminClient.patchRole(channelUserRole.id, {
                permissions: originalPermissions.filter(
                    (permission: string) => permission !== 'manage_public_channel_members',
                ),
            });
            const channelsPage = await openChannel(pw, regularUser, team.name, channel.name);

            // # Mention the group without Manage Members permission
            await channelsPage.postGroupMention(groupName);

            // * Verify the warning is shown without an add-member link
            await channelsPage.assertOutOfChannelMentionMessage(boardUser.username, false);
        } finally {
            await adminClient.patchRole(channelUserRole.id, {permissions: originalPermissions});
        }
    });
});
