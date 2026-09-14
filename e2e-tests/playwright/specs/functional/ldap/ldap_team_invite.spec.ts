// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an LDAP member who has been invited to a team lands on that team's channel
 * after login.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('LDAP member login with team invite lands on the invited team', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    const team = await pw.createNewTeam(adminClient);
    const ldapUser = pw.generateLdapUser('ldapmember');
    await pw.createLdapUser(ldapUser);

    // # Log in once to provision the member, then grant team membership
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);
    await pw.loginPage.expectNotOnLoginPage();

    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await adminClient.revokeAllSessionsForUser(provisionedUser.id);

    // # Log in again now that the member belongs to the invited team
    await pw.loginPage.expectLoginRedirectFrom('/login');
    await pw.loginPage.toBeVisible();
    await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);
    await pw.loginPage.expectNotOnLoginPage();

    // * Verify login itself lands on the invited team
    await pw.channelsPage.expectOnTeamChannel(team.name);
});

/**
 * @objective Verify an LDAP guest who has been invited to a team and channel lands on that
 * channel after login.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('LDAP guest login with team invite lands on the invited channel', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    const team = await pw.createNewTeam(adminClient);
    const ldapUser = pw.generateLdapUser('ldapguestinv');
    await pw.createLdapUser(ldapUser);

    try {
        await adminClient.patchConfig({
            GuestAccountsSettings: {Enable: true},
            LdapSettings: {UserFilter: '(cn=no_such_user)', GuestFilter: `(cn=${ldapUser.firstname})`},
        });

        // # Log in once to provision the guest
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);
        await pw.loginPage.expectNotOnLoginPage();

        const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
        expect(provisionedUser.roles.split(' ')).toContain('system_guest');

        // # Invite the guest to the team and default channel
        await adminClient.addToTeam(team.id, provisionedUser.id);
        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        await adminClient.addToChannel(provisionedUser.id, townSquare.id);
        await adminClient.revokeAllSessionsForUser(provisionedUser.id);

        // # Log in again now that the guest belongs to the invited team
        await pw.loginPage.expectLoginRedirectFrom('/login');
        await pw.loginPage.toBeVisible();
        await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);
        await pw.loginPage.expectNotOnLoginPage();

        // * Verify login itself lands on the invited channel
        await pw.channelsPage.expectOnTeamChannel(team.name, 'town-square');
    } finally {
        await adminClient.patchConfig({
            GuestAccountsSettings: {Enable: originalConfig.GuestAccountsSettings.Enable},
            LdapSettings: {
                UserFilter: originalConfig.LdapSettings.UserFilter,
                GuestFilter: originalConfig.LdapSettings.GuestFilter,
            },
        });
    }
});
