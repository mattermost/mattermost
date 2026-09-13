// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an email/password user can switch their sign-in method to AD/LDAP.
 *
 * @precondition
 * A licensed server with OpenLDAP configured and authentication transfer enabled.
 */
test('switches an email account to AD/LDAP', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureOpenldap();
    const ldapUser = {
        username: `ldap${pw.random.id()}`,
        password: 'Password1',
        email: user.email,
        firstname: user.first_name || 'First',
        lastname: user.last_name || 'Last',
    };

    try {
        await pw.createLdapUser(ldapUser);

        // # Log in as the email user and open Switch to AD/LDAP
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.login(user);
        await pw.channelsPage.goto(team.name);
        await pw.channelsPage.toBeVisible();

        const profileModal = await pw.channelsPage.openProfileModal();
        await profileModal.openSecurityTab();
        await profileModal.securityTab.clickSwitchToLdap();
        await pw.emailToLdapPage.toBeVisible();

        // # Confirm the email password and the matching LDAP credentials
        await pw.emailToLdapPage.submit(user.password, ldapUser.username, ldapUser.password);

        // * Verify the account now authenticates through LDAP
        await pw.loginPage.expectOnLoginPage();
        const switched = await adminClient.getUser(user.id);
        expect(switched.auth_service).toBe('ldap');

        // # Log in with the LDAP username and password
        await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);

        // * Verify LDAP login succeeds
        await pw.loginPage.expectNotOnLoginPage();
    } finally {
        await pw.deleteLdapUser(ldapUser.username).catch(() => undefined);
        await adminClient.patchConfig({LdapSettings: {Enable: false}});
    }
});
