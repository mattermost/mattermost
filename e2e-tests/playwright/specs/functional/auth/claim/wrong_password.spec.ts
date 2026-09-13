// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify switching from email to OpenID is rejected when the current password is wrong.
 *
 * @precondition
 * A licensed server with Keycloak OpenID configured and authentication transfer enabled.
 */
test('rejects email-to-OpenID when the current password is wrong', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureSiteUrl();
    await pw.ensureKeycloakOpenId();

    try {
        // # Log in as the email user and open Switch to OpenID
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.login(user);
        await pw.channelsPage.goto(team.name);
        await pw.channelsPage.toBeVisible();

        const profileModal = await pw.channelsPage.openProfileModal();
        await profileModal.openSecurityTab();
        await profileModal.securityTab.clickSwitchToOpenId();
        await pw.emailToOAuthPage.toBeVisible();

        // # Submit the wrong current password
        await pw.emailToOAuthPage.submit('WrongPassword1');

        // * Verify the switch is rejected and the auth method is unchanged
        await expect(pw.emailToOAuthPage.invalidPasswordError).toBeVisible();
        const unchanged = await adminClient.getUser(user.id);
        expect(unchanged.auth_service).toBe('');
    } finally {
        await adminClient.patchConfig({OpenIdSettings: {Enable: false}});
    }
});

/**
 * @objective Verify switching from email to AD/LDAP is rejected when the current password is wrong.
 *
 * @precondition
 * A licensed server with OpenLDAP configured and authentication transfer enabled.
 */
test('rejects email-to-LDAP when the current password is wrong', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureOpenldap();
    const ldapUser = pw.generateLdapUser('claimbad');
    await pw.createLdapUser(ldapUser);

    try {
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

        // # Submit the wrong email password with valid LDAP credentials
        await pw.emailToLdapPage.submit('WrongPassword1', ldapUser.username, ldapUser.password);

        // * Verify the switch is rejected and the auth method is unchanged
        await expect(pw.emailToLdapPage.invalidPasswordError).toBeVisible();
        const unchanged = await adminClient.getUser(user.id);
        expect(unchanged.auth_service).toBe('');
    } finally {
        await adminClient.patchConfig({LdapSettings: {Enable: false}});
    }
});
