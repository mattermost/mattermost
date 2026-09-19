// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an AD/LDAP user can switch their sign-in method to email and password.
 *
 * @precondition
 * A licensed server with OpenLDAP configured and authentication transfer enabled.
 */
test('switches an AD/LDAP account to email and password', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, team} = await pw.initSetup();
    await pw.ensureOpenldap();
    const ldapUser = pw.generateLdapUser('claimldap');
    const newPassword = pw.newTestPassword();

    try {
        await pw.createLdapUser(ldapUser);

        // # Provision the user through LDAP login
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);
        await pw.loginPage.expectNotOnLoginPage();

        const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
        await adminClient.addToTeam(team.id, provisionedUser.id);
        await pw.channelsPage.goto(team.name);
        await pw.channelsPage.toBeVisible();

        // # Open Switch to Email and Password and set a new password
        const profileModal = await pw.channelsPage.openProfileModal();
        await profileModal.openSecurityTab();
        await profileModal.securityTab.clickSwitchToEmail();
        await pw.ldapToEmailPage.toBeVisible();
        await pw.ldapToEmailPage.submit(ldapUser.password, newPassword);

        // * Verify the account now authenticates with email/password
        await pw.loginPage.expectOnLoginPage();
        const switched = await adminClient.getUser(provisionedUser.id);
        expect(switched.auth_service).toBe('');

        // # Log in with the new email password
        await pw.loginPage.submitCredentials(provisionedUser.email, newPassword);

        // * Verify email login succeeds
        await pw.loginPage.expectNotOnLoginPage();
    } finally {
        await pw.deleteLdapUser(ldapUser.username).catch(() => undefined);
        await adminClient.patchConfig({LdapSettings: {Enable: false}});
    }
});
