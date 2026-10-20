// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user who only exists in the directory can authenticate through the
 * standard login form once LDAP is enabled, and is provisioned via LDAP on first login.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('MM-T2704 logs in a directory-only user through the standard login form', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser();
    await pw.createLdapUser(ldapUser);

    // # Log in through the real login form with the directory-only user's credentials
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Verify the login form reflects LDAP being enabled
    await expect(pw.loginPage.loginWithAdLdapPlaceholder).toBeVisible();

    await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);

    // * Verify the server provisioned the account via LDAP
    await pw.loginPage.expectNotOnLoginPage();
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.auth_service).toBe('ldap');
    expect(provisionedUser.email).toBe(ldapUser.email);
});

/**
 * @objective Verify an already-provisioned LDAP admin can log in again through the standard form.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('logs in an existing LDAP admin through the standard login form', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser('ldapadmin');
    await pw.createLdapUser(ldapUser);

    await adminClient.patchConfig({
        LdapSettings: {EnableAdminFilter: true, AdminFilter: `(cn=${ldapUser.firstname})`},
    });

    // # Log in once to provision the admin account
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);
    await pw.loginPage.expectNotOnLoginPage();

    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_admin');

    // # Log out and log in again as the same LDAP admin
    await adminClient.revokeAllSessionsForUser(provisionedUser.id);
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);

    // * Verify the existing admin can log in again
    await pw.loginPage.expectNotOnLoginPage();
    const reloginUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(reloginUser.roles.split(' ')).toContain('system_admin');
});
