// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, SystemConsolePage, expect, test} from '@mattermost/playwright-lib';

import {initializeLdapGroupSync, setupLdapGroupSync} from './support';

test.describe('LDAP group membership and configuration', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await initializeLdapGroupSync(pw);
    });

    /**
     * @objective Verify removing one synchronized LDAP group from a channel persists
     */
    test('MM-T1537 - Sync Group Removal from Channel Configuration Page', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, channel, board, developers} = await setupLdapGroupSync(pw);
        await adminClient.linkGroupSyncable(board.id, channel.id, 'channel', {auto_add: true});
        await adminClient.linkGroupSyncable(developers.id, channel.id, 'channel', {auto_add: true});
        const {page} = await pw.testBrowser.login(adminUser);
        const consolePage = new SystemConsolePage(page);

        // # Open channel configuration and remove the board group
        await consolePage.channelConfiguration.goto(channel.id);
        await expect(page.getByText('board', {exact: true})).toBeVisible();
        await page.getByRole('link', {name: 'Remove'}).first().click();
        await consolePage.channelConfiguration.save();
        await expect
            .poll(
                async () =>
                    (await adminClient.getGroupSyncableIncludingDeleted(board.id, channel.id, 'channel')).delete_at,
                {timeout: duration.half_min},
            )
            .not.toBe(0);
        expect(
            (await adminClient.getGroupSyncableIncludingDeleted(developers.id, channel.id, 'channel')).delete_at,
        ).toBe(0);
        await consolePage.channelConfiguration.goto(channel.id);

        // * Verify only the developers group remains
        await expect(page.getByText('developers', {exact: true})).toBeVisible();
        await expect(page.getByText('board', {exact: true})).not.toBeVisible();
    });

    /**
     * @objective Verify removing a synchronized team membership from an LDAP group warns about future users
     */
    test(
        "MM-T2618 - Team Configuration Page: Group removal User removed from sync'ed team",
        {tag: '@ldap'},
        async ({pw}) => {
            const {adminClient, adminUser, team, board} = await setupLdapGroupSync(pw);
            await adminClient.linkGroupSyncable(board.id, team.id, 'team', {auto_add: true});
            const {page} = await pw.testBrowser.login(adminUser);
            const consolePage = new SystemConsolePage(page);

            // # Open the board group and remove its synchronized team
            await page.goto('/admin_console/user_management/groups');
            await expect(page.getByText('AD/LDAP Groups', {exact: true})).toBeVisible();
            await page.getByRole('link', {name: 'Edit', exact: true}).first().click();
            await expect(page.getByText(team.display_name, {exact: true})).toBeVisible();
            await consolePage.groupConfiguration.requestRemoveTeamOrChannel(team.display_name);

            // * Verify the removal warning identifies the team
            await expect(
                page.getByText(
                    `Removing this membership will prevent future users in this group from being added to the ${team.display_name} team.`,
                ),
            ).toBeVisible();

            // # Confirm and save
            await consolePage.groupConfiguration.confirmRemoveTeamOrChannel();
            await page.getByRole('button', {name: 'Save', exact: true}).click();
        },
    );

    /**
     * @objective Verify team management labels distinguish open and invite-only teams
     */
    test('MM-T2621 - Team List Management Column', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, team} = await setupLdapGroupSync(pw);
        const inviteOnlyTeam = await adminClient.createTeam({...(await pw.random.team()), type: 'I'});
        await adminClient.updateTeam({...team, allow_open_invite: true});
        const {page} = await pw.testBrowser.login(adminUser);
        const consolePage = new SystemConsolePage(page);
        await page.goto('/admin_console/user_management/teams');

        // # Search for the open team
        await consolePage.managementLists.search(team.display_name);

        // * Verify it is labeled Anyone Can Join
        await consolePage.managementLists.expectTeamManagementLabel(team.name, 'Anyone Can Join');

        // # Search for the invite-only team
        await consolePage.managementLists.search(inviteOnlyTeam.display_name);

        // * Verify it is labeled Invite Only
        await consolePage.managementLists.expectTeamManagementLabel(inviteOnlyTeam.name, 'Invite Only');
    });
});
