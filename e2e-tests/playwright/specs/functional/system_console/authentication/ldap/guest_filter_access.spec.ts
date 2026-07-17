// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {SystemConsolePage, expect, test} from '@mattermost/playwright-lib';

import {getLdapUser, ldapUsers, loginFromPage, setupLdap} from './support';

test.describe('LDAP authentication and guest filters', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await setupLdap(pw);
    });

    /**
     * @objective Verify LDAP and SAML guest filters are disabled and ignored when guest access is disabled
     */
    test('MM-T1424 LDAP Guest Filter behavior when Guest Access is disabled', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        const user = await getLdapUser(adminClient, ldapUsers.guestFilterOne);
        const {page} = await pw.testBrowser.login(adminUser!);
        const consolePage = new SystemConsolePage(page);

        // # Enable guests and restore the LDAP account as a regular member
        await consolePage.guestAccess.goto();
        await consolePage.guestAccess.setEnabled(true);
        await adminClient.runLdapSync();
        await adminClient.promoteGuestToUser(user.id).catch(() => undefined);

        // # Configure a guest filter, then disable guest access
        await consolePage.ldap.goto();
        await consolePage.ldap.expandAdditionalFilters();
        await consolePage.ldap.setGuestFilter(`(uid=${ldapUsers.guestFilterOne.username})`);
        await consolePage.guestAccess.goto();
        await consolePage.guestAccess.setEnabled(false);

        // * Verify LDAP and SAML guest filter controls are disabled
        await consolePage.ldap.goto();
        await expect(page.getByTestId('LdapSettings.GuestFilterinput')).toBeDisabled();
        await consolePage.saml.goto();
        await expect(page.getByTestId('SamlSettings.GuestAttributeinput')).toBeDisabled();

        // # Log in again after disabling guest access
        await loginFromPage(pw, ldapUsers.guestFilterOne);

        // * Verify the disabled guest filter does not demote the LDAP user
        expect((await adminClient.getUser(user.id)).roles).not.toContain('system_guest');
    });

    /**
     * @objective Verify a guest in a group-synchronized team cannot invite another guest
     */
    test('MM-T1427 Prevent Invite Guest for LDAP Group Synced Teams', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.patchConfig({
            GuestAccountsSettings: {Enable: true},
            LdapSettings: {GuestFilter: '(cn=board*)'},
        });
        await adminClient.runLdapSync();
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, adminUser!.id);
        const {groups} = await adminClient.getLdapGroups();
        const board = groups.find((group: {name: string}) => group.name === 'board');
        expect(board).toBeTruthy();
        const linked = board!.mattermost_group_id
            ? await adminClient.getGroup(board!.mattermost_group_id)
            : await adminClient.linkLdapGroup(board!.primary_key);
        expect(linked).toBeTruthy();
        await adminClient.linkGroupSyncable(linked!.id, team.id, 'team', {auto_add: true});
        await adminClient.runLdapSync();
        const {user: authenticatedMember} = await pw.makeClient(ldapUsers.guest, {useCache: false});
        if (!authenticatedMember) {
            throw new Error(`Unable to authenticate LDAP member ${ldapUsers.guest.username}`);
        }
        await adminClient.promoteGuestToUser(authenticatedMember.id).catch(() => undefined);
        const member = {...authenticatedMember, password: ldapUsers.guest.password} as UserProfile;
        await adminClient.createGroupTeamsAndChannels(member.id);
        await adminClient.getTeamMember(team.id, member.id).catch(() => adminClient.addToTeam(team.id, member.id));
        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        await adminClient
            .getChannelMember(townSquare.id, member.id)
            .catch(() => adminClient.addToChannel(member.id, townSquare.id));

        // # Log in as the synchronized member and open the team menu
        const {channelsPage} = await pw.testBrowser.login(member);
        await channelsPage.goto(team.name, 'town-square');
        const teamMenu = await channelsPage.openTeamMenu();

        // * Verify inviting people is unavailable for the group-synchronized team
        await expect(teamMenu.invitePeople).not.toBeVisible();
    });
});
