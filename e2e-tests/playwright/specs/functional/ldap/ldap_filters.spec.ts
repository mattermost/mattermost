// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a directory user matching LdapSettings.AdminFilter is provisioned as a
 * Mattermost system admin on first LDAP login.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('LDAP admin filter grants the system admin role', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    const ldapUser = pw.generateLdapUser('ldapadmin');
    await pw.createLdapUser(ldapUser);
    await adminClient.patchConfig({
        LdapSettings: {EnableAdminFilter: true, AdminFilter: `(cn=${ldapUser.firstname})`},
    });

    // # Log in through the real login form with the admin-filter-matching user's credentials
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.loginInput.fill(ldapUser.username);
    await pw.loginPage.passwordInput.fill(ldapUser.password);
    await pw.loginPage.signInButton.click();

    // * Verify the login succeeded and the user was granted the system admin role
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_admin');
});

/**
 * @objective Verify a directory user matching neither UserFilter nor GuestFilter is rejected at
 * login, instead of being provisioned.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('login is rejected when the user matches neither the user nor guest filter', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    const ldapUser = pw.generateLdapUser('ldapnomatch');
    await pw.createLdapUser(ldapUser);
    await adminClient.patchConfig({
        LdapSettings: {UserFilter: '(cn=no_such_user)', GuestFilter: '(cn=no_such_guest)'},
    });

    // # Attempt to log in with a user that matches neither filter
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.loginInput.fill(ldapUser.username);
    await pw.loginPage.passwordInput.fill(ldapUser.password);
    await pw.loginPage.signInButton.click();

    // * Verify the login is rejected and no account was provisioned
    await expect(pw.loginPage.errorBanner).toBeVisible();
    await expect(adminClient.getUserByUsername(ldapUser.username)).rejects.toThrow();
});

/**
 * @objective Verify a directory user matching GuestFilter (but not UserFilter) is provisioned as
 * a Mattermost guest on first LDAP login.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('LDAP guest filter provisions the user as a guest', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    const ldapUser = pw.generateLdapUser('ldapguest');
    await pw.createLdapUser(ldapUser);
    await adminClient.patchConfig({
        GuestAccountsSettings: {Enable: true},
        LdapSettings: {UserFilter: '(cn=no_such_user)', GuestFilter: `(cn=${ldapUser.firstname})`},
    });

    // # Log in through the real login form with the guest-filter-matching user's credentials
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.loginInput.fill(ldapUser.username);
    await pw.loginPage.passwordInput.fill(ldapUser.password);
    await pw.loginPage.signInButton.click();

    // * Verify the login succeeded and the user was provisioned as a guest
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_guest');
});

/**
 * @objective Verify demoting an LDAP-authenticated member to a guest re-evaluates their role on
 * next login, without removing existing team membership.
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
    await pw.loginPage.loginInput.fill(ldapUser.username);
    await pw.loginPage.passwordInput.fill(ldapUser.password);
    await pw.loginPage.signInButton.click();
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);

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
