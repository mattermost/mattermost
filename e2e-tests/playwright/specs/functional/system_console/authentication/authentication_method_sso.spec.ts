// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an LDAP-provisioned user's System Console profile shows Authentication Method LDAP.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('shows LDAP as the authentication method for a directory user', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();

    const {adminUser, adminClient} = await pw.initSetup();
    const ldapUser = pw.generateLdapUser();
    await pw.createLdapUser(ldapUser);

    // # Provision the directory user through the login form
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.submitCredentials(ldapUser.username, ldapUser.password);
    await pw.loginPage.expectNotOnLoginPage();

    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open the LDAP user's System Console profile
    await systemConsolePage.gotoUser(provisionedUser.id);

    // * Verify the authentication method is LDAP
    await systemConsolePage.users.userDetail.userCard.expectAuthenticationMethod('LDAP');
});

/**
 * @objective Verify a SAML user's System Console profile shows Authentication Method SAML.
 *
 * @precondition
 * A licensed server with the User Detail page available.
 */
test('shows SAML as the authentication method for a SAML user', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, user} = await pw.initSetup();
    await adminClient.updateUserAuth(user.id, {auth_service: 'saml', auth_data: user.email});

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open the SAML user's System Console profile
    await systemConsolePage.gotoUser(user.id);

    // * Verify the authentication method is SAML
    await systemConsolePage.users.userDetail.userCard.expectAuthenticationMethod('SAML');
});
