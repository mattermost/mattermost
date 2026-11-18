// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectSignedIn, logIn} from '../support';

import {logInToTeam, switchSignInTo} from './support';

/**
 * @objective Verify an email account can be switched to AD/LDAP and then log in with its LDAP credentials.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('switches an email account to AD/LDAP', {tag: '@authentication'}, async ({pw, page}) => {
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

    await pw.createTestLdapUser(ldapUser);

    // # Log in with email and open the switch to AD/LDAP
    const app = await logInToTeam(pw, page, user.username, user.password, team);
    await switchSignInTo(app, 'ldap');

    // # Switch the account to AD/LDAP
    const claim = app.claim.emailToLdap;
    await claim.passwordTextbox.fill(user.password);
    await claim.ldapIdTextbox.fill(ldapUser.username);
    await claim.ldapPasswordTextbox.fill(ldapUser.password);
    await claim.submitButton.click();

    // * Verify the account now signs in with AD/LDAP
    await expect(page).toHavePath(app.loginPage.pathFor());
    expect((await adminClient.getUser(user.id)).auth_service).toBe('ldap');

    // # Log in with the LDAP credentials
    await logIn(app, ldapUser.username, ldapUser.password);

    // * Verify the login succeeds
    await expectSignedIn(page);
});
