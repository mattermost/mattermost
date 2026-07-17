// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, SystemConsolePage, expect, test} from '@mattermost/playwright-lib';

test.describe('LDAP group role assignments', () => {
    async function setup(pw: any, groupName = 'board') {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.initializeOpenLdap();
        const group = await adminClient.getOrLinkLdapGroup(groupName);
        await adminClient.resetLdapGroup(group.id);
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, adminUser.id);
        const channel = await adminClient.createPublicChannel(team.id, 'Role Assignment Channel');
        const {page} = await pw.testBrowser.login(adminUser);
        return {adminClient, channel, consolePage: new SystemConsolePage(page), group, team};
    }

    /**
     * @objective Verify a system administrator can persist, revert, and remove a group role from Team Configuration
     * @precondition MM-21789 is consolidated here because its Team Admin persistence assertion is already an intermediate verification in MM-20059.
     */
    test('MM-20059 MM-21789 maps and persists group roles from Team Configuration', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, group, team} = await setup(pw);

        // # Find the team and add the linked LDAP group
        await consolePage.managementLists.gotoTeams();
        await consolePage.managementLists.search(team.display_name);
        await consolePage.managementLists.openOnlyResult();
        await consolePage.teamConfiguration.addGroup(group.display_name);

        // # Promote the group to Team Admin and save
        await consolePage.teamConfiguration.changeGroupRole('Member', 'Team Admin');
        await consolePage.teamConfiguration.save();
        await expect
            .poll(
                async () =>
                    (await adminClient.getGroupSyncableIncludingDeleted(group.id, team.id, 'team')).scheme_admin,
                {timeout: duration.half_min},
            )
            .toBe(true);
        await consolePage.managementLists.gotoTeams();
        await consolePage.managementLists.search(team.display_name);
        await consolePage.managementLists.openOnlyResult();

        // * Verify the Team Admin role persisted
        await consolePage.teamConfiguration.expectGroupRole('Team Admin');

        // # Revert the role to Member and save
        await consolePage.teamConfiguration.changeGroupRole('Team Admin', 'Member');
        await consolePage.teamConfiguration.save();
        await expect
            .poll(
                async () =>
                    (await adminClient.getGroupSyncableIncludingDeleted(group.id, team.id, 'team')).scheme_admin,
                {timeout: duration.half_min},
            )
            .toBe(false);
        await consolePage.managementLists.gotoTeams();
        await consolePage.managementLists.search(team.display_name);
        await consolePage.managementLists.openOnlyResult();

        // * Verify the Member role persisted
        await consolePage.teamConfiguration.expectGroupRole('Member');

        // # Remove the group and save
        await consolePage.teamConfiguration.removeGroup(group.display_name);
        await consolePage.teamConfiguration.save();
        await expect
            .poll(
                async () => (await adminClient.getGroupSyncableIncludingDeleted(group.id, team.id, 'team')).delete_at,
                {timeout: duration.half_min},
            )
            .not.toBe(0);
        await consolePage.managementLists.gotoTeams();
        await consolePage.managementLists.search(team.display_name);
        await consolePage.managementLists.openOnlyResult();

        // * Verify the group remains removed
        await consolePage.teamConfiguration.expectNoGroups();
    });

    /**
     * @objective Verify a system administrator can persist and revert a group role from Channel Configuration
     * @precondition MM-21789 is consolidated here because its Channel Admin persistence assertion is already an intermediate verification in MM-20646.
     */
    test('MM-20646 MM-21789 maps and persists group roles from Channel Configuration', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, channel, consolePage, group} = await setup(pw);

        // # Find the channel and add the linked LDAP group
        await consolePage.managementLists.gotoChannels();
        await consolePage.managementLists.search(channel.display_name);
        await consolePage.managementLists.openOnlyResult();
        await consolePage.channelConfiguration.addGroup(group.display_name);

        // # Promote the group to Channel Admin and save
        await consolePage.channelConfiguration.changeGroupRole('Member', 'Channel Admin');
        await consolePage.channelConfiguration.save();
        await expect
            .poll(
                async () =>
                    (await adminClient.getGroupSyncableIncludingDeleted(group.id, channel.id, 'channel')).scheme_admin,
                {timeout: duration.half_min},
            )
            .toBe(true);
        await consolePage.managementLists.gotoChannels();
        await consolePage.managementLists.search(channel.display_name);
        await consolePage.managementLists.openOnlyResult();

        // * Verify the Channel Admin role persisted
        await consolePage.channelConfiguration.expectGroupRole('Channel Admin');

        // # Revert the role to Member and save
        await consolePage.channelConfiguration.changeGroupRole('Channel Admin', 'Member');
        await consolePage.channelConfiguration.save();
        await expect
            .poll(
                async () =>
                    (await adminClient.getGroupSyncableIncludingDeleted(group.id, channel.id, 'channel')).scheme_admin,
                {timeout: duration.half_min},
            )
            .toBe(false);
        await consolePage.managementLists.gotoChannels();
        await consolePage.managementLists.search(channel.display_name);
        await consolePage.managementLists.openOnlyResult();

        // * Verify the Member role persisted
        await consolePage.channelConfiguration.expectGroupRole('Member');
    });

    /**
     * @objective Verify an administrator role assigned from an LDAP group configuration is saved
     */
    test('MM-T2668 saves an administrator role for a group membership', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, channel, consolePage, group, team} = await setup(pw, 'developers');

        // # Add and save the team before its channel so their implied team links are not created concurrently
        await consolePage.groupConfiguration.goto(group.id);
        await consolePage.groupConfiguration.addTeamOrChannel('Team', team.display_name);
        await consolePage.groupConfiguration.save();
        await expect
            .poll(
                async () => (await adminClient.getGroupSyncableIncludingDeleted(group.id, team.id, 'team')).delete_at,
                {timeout: duration.half_min},
            )
            .toBe(0);
        await consolePage.groupConfiguration.addTeamOrChannel('Channel', channel.display_name);

        // * Verify each membership starts with the Member role
        await consolePage.groupConfiguration.expectMembershipRole(channel.display_name, 'Member');

        // # Promote the team membership and save
        await consolePage.groupConfiguration.changeMembershipRole(team.display_name, 'Member', 'Team Admin');
        await consolePage.groupConfiguration.save();
        await expect
            .poll(
                async () =>
                    (await adminClient.getGroupSyncableIncludingDeleted(group.id, team.id, 'team')).scheme_admin,
                {timeout: duration.half_min},
            )
            .toBe(true);
        await consolePage.groupConfiguration.goto(group.id);

        // * Verify the administrator role persisted
        await consolePage.groupConfiguration.expectMembershipRole(team.display_name, 'Team Admin');
    });
});
