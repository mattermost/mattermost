// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectOnLoginPage} from '../support';

import {logInToTeam, switchSignInTo} from './support';

/**
 * @objective Verify an email/password user can switch their sign-in method to OpenID SSO.
 *
 * @precondition
 * A licensed server with Keycloak OpenID configured and authentication transfer enabled.
 */
test('switches an email account to OpenID SSO', {tag: '@authentication'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureSiteUrl();
    await pw.ensureKeycloakOpenId();
    const keycloakUser = {
        username: `kc${user.username}`,
        email: user.email,
        firstName: user.first_name || 'First',
        lastName: user.last_name || 'Last',
        password: 'Password1',
    };
    await pw.createKeycloakUser(keycloakUser);

    // # Log in as the email user and open the switch to OpenID
    const app = await logInToTeam(pw, page, user.username, user.password, team);
    await switchSignInTo(app, 'openid');

    // # Confirm the current password and complete Keycloak's login (its hosted page, outside the webapp)
    const claim = app.claim.emailToOauth;
    await claim.passwordTextbox.fill(user.password);
    // The switch navigates away at once (to the identity provider or the login page), so its response body can't be read: the next line observes the result.
    await claim.submitButton.click();
    // The claim response redirects to Keycloak's hosted form outside the generated webapp surface.
    await expect(pw.keycloakLoginPage.usernameInput).toBeVisible();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify the account now authenticates through OpenID
    await expectOnLoginPage(page);
    expect((await adminClient.getUser(user.id)).auth_service).toBe('openid');
});
