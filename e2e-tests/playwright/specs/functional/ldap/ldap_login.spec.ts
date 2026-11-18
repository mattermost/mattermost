// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, expectSignedIn, logIn, openLogin, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a directory-only user can log in through the standard login form.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('MM-T2704 logs in a directory-only user through the standard login form', {tag: '@ldap'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser();
    await pw.createLdapUser(ldapUser);

    // * Verify the login field offers AD/LDAP usernames
    const app = await openLogin(pw, page);
    await expect(app.login.loginId.container).toBeVisible();
    await expect(app.login.loginId.container).toHaveAccessibleName('Email, Username or AD/LDAP Username');

    // # Log in with the LDAP username
    await logIn(app, ldapUser.username, ldapUser.password);
    await expectSignedIn(page);

    // * Verify the user is provisioned from LDAP
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.auth_service).toBe('ldap');
    expect(provisionedUser.email).toBe(ldapUser.email);
});

/**
 * @objective Verify an LDAP admin keeps the admin role across logins.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('logs in an existing LDAP admin through the standard login form', {tag: '@ldap'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser('ldapadmin');
    await pw.createLdapUser(ldapUser);

    await adminClient.patchConfig({
        LdapSettings: {EnableAdminFilter: true, AdminFilter: `(cn=${ldapUser.firstname})`},
    });

    // # Log in as the LDAP admin
    let app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);
    await expectSignedIn(page);

    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_admin');

    // # Log out everywhere and log in again
    await adminClient.revokeAllSessionsForUser(provisionedUser.id);
    app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);
    await expectSignedIn(page);

    // * Verify the user is still a system admin
    const reloginUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(reloginUser.roles.split(' ')).toContain('system_admin');
});
