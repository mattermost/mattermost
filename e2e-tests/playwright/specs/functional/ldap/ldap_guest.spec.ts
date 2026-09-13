// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify demoting an LDAP-authenticated member to a guest changes their role without
 * removing existing team membership.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('demoting an LDAP user to guest changes their role but keeps team membership', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({GuestAccountsSettings: {Enable: true}});
    const team = await pw.createNewTeam(adminClient);
    const ldapUser = pw.generateLdapUser('ldapdemote');
    await pw.createLdapUser(ldapUser);

    // # Log in once as a regular member and grant team membership
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);
    await pw.loginPage.expectNotOnLoginPage();

    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    await adminClient.addToTeam(team.id, provisionedUser.id);

    // # Demote the user to guest
    await adminClient.demoteUserToGuest(provisionedUser.id);

    // * Verify the role changed to guest while team membership is retained
    const demotedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(demotedUser.roles.split(' ')).toContain('system_guest');
    const teamMembership = await adminClient.getTeamMember(team.id, provisionedUser.id);
    expect(teamMembership.team_id).toBe(team.id);
});
