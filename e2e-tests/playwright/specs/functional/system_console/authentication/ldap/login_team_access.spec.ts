// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getLdapUser, ldapUsers, loginFromPage, setupLdap} from './support';

test.describe('LDAP authentication and guest filters', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await setupLdap(pw);
    });

    /**
     * @objective Verify an LDAP member can log in after being invited to a team
     */
    test('LDAP Member login with team invite', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.patchConfig({LdapSettings: {UserFilter: '(cn=test*)'}});
        const user = await getLdapUser(adminClient, ldapUsers.member);
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, adminUser!.id);
        await adminClient.addToTeam(team.id, user.id);

        // # Log in as the invited LDAP member
        await loginFromPage(pw, ldapUsers.member);

        // * Verify the invited team is available
        await expect(pw.loginPage.page.getByText(team.display_name, {exact: true}).first()).toBeVisible();
    });

    /**
     * @objective Verify an LDAP guest can log in after being invited to a team and channel
     */
    test('LDAP Guest login with team invite', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.patchConfig({
            GuestAccountsSettings: {Enable: true},
        });
        const user = await getLdapUser(adminClient, ldapUsers.guest);
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, adminUser!.id);
        await adminClient.addToTeam(team.id, user.id);
        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        await adminClient.addToChannel(user.id, channel.id);

        // # Log in as the invited LDAP guest
        await loginFromPage(pw, ldapUsers.guest);

        // * Verify Town Square is available
        await expect(pw.loginPage.page.getByText('Town Square', {exact: true}).first()).toBeVisible();
    });

    /**
     * @objective Verify a new LDAP account can be created by logging in
     */
    test('MM-T2704 Create new LDAP account from login page', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await adminClient.runLdapSync();

        // # Log in as a synchronized LDAP account
        await loginFromPage(pw, ldapUsers.guestFilterOne);

        // * Verify the account is logged in
        await expect(pw.loginPage.page.getByRole('link', {name: /Logout/i})).toBeVisible();
    });
});
