// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectSignedIn, logIn, logInWithKeycloak} from '../support';

import {switchSignInTo} from './support';

/**
 * @objective Verify an OpenID SSO user can switch their sign-in method to email and password.
 *
 * @precondition
 * A licensed server with Keycloak OpenID configured and authentication transfer enabled.
 */
test('switches an OpenID account to email and password', {tag: '@authentication'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, team, townSquare} = await pw.initSetup();
    await pw.ensureSiteUrl();
    await pw.ensureKeycloakOpenId();
    const keycloakUser = pw.generateKeycloakUser('openidclaim');
    await pw.createKeycloakUser(keycloakUser);
    const newPassword = pw.newTestPassword();

    // # Provision the user through OpenID SSO (Keycloak's hosted login page)
    const app = await logInWithKeycloak(pw, page, 'openid', keycloakUser);
    await expectSignedIn(page);

    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open the switch to email and set a new password
    await switchSignInTo(app, 'email', 'openid');
    const claim = app.claim.oauthToEmail;
    await claim.passwordTextbox.fill(newPassword);
    await claim.confirmTextbox.fill(newPassword);
    // The switch navigates away at once (to the identity provider or the login page), so its response body can't be read: the next line observes the result.
    await claim.submitButton.click();

    // * Verify the account now authenticates with email/password
    await expect(page).toHavePath(app.loginPage.pathFor());
    expect((await adminClient.getUser(provisionedUser.id)).auth_service).toBe('');

    // # Log in with the new email password
    await logIn(app, provisionedUser.email, newPassword);

    // * Verify email login succeeds
    await expectSignedIn(page);
});
