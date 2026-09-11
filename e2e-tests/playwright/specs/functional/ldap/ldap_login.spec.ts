// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user who only exists in the directory (never created in Mattermost) can
 * authenticate through the standard login form once LDAP authentication is enabled, that the
 * server provisions their account via LDAP on first login rather than local auth, and that they
 * can reach a real channel once they have team membership.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('logs in a directory-only user through the standard login form', {tag: '@ldap'}, async ({pw}) => {
    // Ensure prerequisites
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminClient} = await pw.getAdminClient();
    // A directory-only user has no team until one is granted after they're provisioned below.
    const team = await pw.createNewTeam(adminClient);
    const ldapUser = pw.generateLdapUser();
    await pw.createLdapUser(ldapUser);

    // # Log in through the real login form with the directory-only user's credentials
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Verify the login form reflects LDAP being enabled
    await expect(pw.loginPage.loginWithAdLdapPlaceholder).toBeVisible();

    await pw.loginPage.loginInput.fill(ldapUser.username);
    await pw.loginPage.passwordInput.fill(ldapUser.password);
    await pw.loginPage.signInButton.click();

    // * Verify the login succeeded
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);

    // * Verify the server provisioned the account via LDAP, with the directory's attributes
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.auth_service).toBe('ldap');
    expect(provisionedUser.email).toBe(ldapUser.email);

    // # Grant team membership (the LDAP user had none) and reach its channel
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await pw.channelsPage.goto(team.name);

    // * Verify the user lands on a real channel, not stuck on team selection
    await pw.channelsPage.toBeVisible();
});
