// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a directory user matching LdapSettings.AdminFilter is provisioned as a
 * system admin on first LDAP login.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('MM-T2821 LDAP admin filter grants the system admin role', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    const ldapUser = pw.generateLdapUser('ldapadmin');
    await pw.createLdapUser(ldapUser);

    try {
        await adminClient.patchConfig({
            LdapSettings: {
                EnableAdminFilter: true,
                AdminFilter: `(cn=${ldapUser.firstname})`,
                UserFilter: '(objectClass=inetOrgPerson)',
                GuestFilter: '',
            },
        });

        // # Log in with the admin-filter-matching user's credentials
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);

        // * Verify the user was granted the system admin role
        await pw.loginPage.expectNotOnLoginPage();
        const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
        expect(provisionedUser.roles.split(' ')).toContain('system_admin');
    } finally {
        await adminClient.patchConfig({
            LdapSettings: {
                EnableAdminFilter: originalConfig.LdapSettings.EnableAdminFilter,
                AdminFilter: originalConfig.LdapSettings.AdminFilter,
                UserFilter: originalConfig.LdapSettings.UserFilter,
                GuestFilter: originalConfig.LdapSettings.GuestFilter,
            },
        });
    }
});

/**
 * @objective Verify a directory user matching neither UserFilter nor GuestFilter is rejected at
 * login instead of being provisioned.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('login is rejected when the user matches neither the user nor guest filter', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    const ldapUser = pw.generateLdapUser('ldapnomatch');
    await pw.createLdapUser(ldapUser);

    try {
        await adminClient.patchConfig({
            LdapSettings: {UserFilter: '(cn=no_such_user)', GuestFilter: '(cn=no_such_guest)'},
        });

        // # Attempt to log in with a user that matches neither filter
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);

        // * Verify the login is rejected and no account was provisioned
        await expect(pw.loginPage.errorBanner).toBeVisible();
        await expect(adminClient.getUserByUsername(ldapUser.username)).rejects.toThrow();
    } finally {
        await adminClient.patchConfig({
            LdapSettings: {
                UserFilter: originalConfig.LdapSettings.UserFilter,
                GuestFilter: originalConfig.LdapSettings.GuestFilter,
            },
        });
    }
});

/**
 * @objective Verify a directory user matching GuestFilter (but not UserFilter) is provisioned as
 * a guest on first LDAP login.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('MM-T1422 LDAP guest filter provisions the user as a guest', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    const ldapUser = pw.generateLdapUser('ldapguest');
    await pw.createLdapUser(ldapUser);

    try {
        await adminClient.patchConfig({
            GuestAccountsSettings: {Enable: true},
            LdapSettings: {UserFilter: '(cn=no_such_user)', GuestFilter: `(cn=${ldapUser.firstname})`},
        });

        // # Log in with the guest-filter-matching user's credentials
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);

        // * Verify the user was provisioned as a guest
        await pw.loginPage.expectNotOnLoginPage();
        const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
        expect(provisionedUser.roles.split(' ')).toContain('system_guest');
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
