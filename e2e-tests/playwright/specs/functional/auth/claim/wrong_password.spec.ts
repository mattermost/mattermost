// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {logInToTeam, switchSignInTo} from './support';

const INVALID_PASSWORD = 'Login failed because of invalid password.';

/**
 * @objective Verify switching email to OpenID is refused when the current password is wrong.
 *
 * @precondition
 * A licensed server with Keycloak (OpenID).
 */
test('rejects email-to-OpenID when the current password is wrong', {tag: '@authentication'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureSiteUrl();
    await pw.ensureKeycloakOpenId();

    // # Log in and open the switch to OpenID
    const app = await logInToTeam(pw, page, user.username, user.password, team);
    await switchSignInTo(app, 'openid');

    // # Submit a wrong current password
    const claim = app.claim.emailToOauth;
    await claim.passwordTextbox.fill('WrongPassword1');
    await claim.submitButton.click();

    // * Verify the switch is refused and the account is unchanged
    await expect(claim.serverErrorText).toBeVisible();
    await expect(claim.serverErrorText).toHaveText(INVALID_PASSWORD);
    expect((await adminClient.getUser(user.id)).auth_service).toBe('');
});

/**
 * @objective Verify switching email to AD/LDAP is refused when the current password is wrong.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('rejects email-to-LDAP when the current password is wrong', {tag: '@authentication'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser('claimbad');

    await pw.createTestLdapUser(ldapUser);

    // # Log in and open the switch to AD/LDAP
    const app = await logInToTeam(pw, page, user.username, user.password, team);
    await switchSignInTo(app, 'ldap');

    // # Submit a wrong current password with valid LDAP credentials
    const claim = app.claim.emailToLdap;
    await claim.passwordTextbox.fill('WrongPassword1');
    await claim.ldapIdTextbox.fill(ldapUser.username);
    await claim.ldapPasswordTextbox.fill(ldapUser.password);
    await claim.submitButton.click();

    // * Verify the switch is refused and the account is unchanged
    await expect(claim.passwordErrorText).toBeVisible();
    await expect(claim.passwordErrorText).toHaveText(INVALID_PASSWORD);
    expect((await adminClient.getUser(user.id)).auth_service).toBe('');
});
