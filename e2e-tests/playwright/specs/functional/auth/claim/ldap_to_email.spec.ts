// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectSignedIn, logIn, openLogin} from '../support';

import {switchSignInTo} from './support';

/**
 * @objective Verify an AD/LDAP account can be switched to email and password.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('switches an AD/LDAP account to email and password', {tag: '@authentication'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient, team, townSquare} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser('claimldap');
    const newPassword = pw.newTestPassword();

    await pw.createTestLdapUser(ldapUser);

    // # Log in to provision the LDAP user, add them to the team and open it
    const app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);
    await expectSignedIn(page);
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Switch the account to email and password. The page opens on the MFA step even when MFA is off (its
    // `showMfa` starts true, a product bug); any token is refused and reveals the form.
    await switchSignInTo(app, 'email', 'ldap');
    await app.loginMfa.token.container.fill('000000');
    await app.loginMfa.submitButton.click();
    const claim = app.claim.ldapToEmail;
    // A rejected synthetic MFA submission clears showMfa and reveals the actual LDAP-to-email form.
    await expect(claim.ldapPasswordTextbox).toBeVisible();
    await expect(app.loginMfa.token.container).not.toBeVisible();
    await claim.ldapPasswordTextbox.fill(ldapUser.password);
    await claim.passwordTextbox.fill(newPassword);
    await claim.confirmTextbox.fill(newPassword);
    await claim.submitButton.click();

    // * Verify the account now signs in with email
    await expect(page).toHavePath(app.loginPage.pathFor());
    expect((await adminClient.getUser(provisionedUser.id)).auth_service).toBe('');

    // # Log in with the email and new password
    await logIn(app, provisionedUser.email, newPassword);

    // * Verify the login succeeds
    await expectSignedIn(page);
});
