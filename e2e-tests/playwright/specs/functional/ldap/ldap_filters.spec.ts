// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, expectSignedIn, logIn, openLogin, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the LDAP admin filter grants the system admin role on first login.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('MM-T2821 LDAP admin filter grants the system admin role', {tag: '@ldap'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser('ldapadmin');
    await pw.createLdapUser(ldapUser);

    await adminClient.patchConfig({
        LdapSettings: {
            EnableAdminFilter: true,
            AdminFilter: `(cn=${ldapUser.firstname})`,
        },
    });

    // # Log in as the LDAP user that matches the admin filter
    const app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);
    await expectSignedIn(page);

    // * Verify the provisioned user is a system admin
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_admin');
});

/**
 * @objective Verify login is rejected when the user matches neither the user nor the guest filter.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test(
    'login is rejected when the user matches neither the user nor guest filter',
    {tag: '@ldap'},
    async ({pw, page}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.initSetup();
        await pw.ensureOpenldap();

        const ldapUser = pw.generateLdapUser('ldapnomatch');
        await pw.createLdapUser(ldapUser);

        await adminClient.patchConfig({
            LdapSettings: {UserFilter: '(cn=no_such_user)', GuestFilter: '(cn=no_such_guest)'},
        });

        // # Log in as an LDAP user that matches no filter
        const app = await openLogin(pw, page);
        await logIn(app, ldapUser.username, ldapUser.password, {status: 401});

        // * Verify the login is rejected and no user is provisioned
        await expect(app.login.banner).toBeVisible();
        await expect(page).toHavePath(app.loginPage.pathFor());
        await expect(adminClient.getUserByUsername(ldapUser.username)).rejects.toThrow();
    },
);

/**
 * @objective Verify the LDAP guest filter provisions the user as a guest.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('MM-T1422 LDAP guest filter provisions the user as a guest', {tag: '@ldap'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser('ldapguest');
    await pw.createLdapUser(ldapUser);

    await adminClient.patchConfig({
        GuestAccountsSettings: {Enable: true},
        LdapSettings: {UserFilter: '(cn=no_such_user)', GuestFilter: `(cn=${ldapUser.firstname})`},
    });

    // # Log in as the LDAP user that matches the guest filter
    const app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);
    await expectSignedIn(page);

    // * Verify the provisioned user is a guest
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_guest');
});
