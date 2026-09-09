// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, getRandomId} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user who only exists in Keycloak (never created in Mattermost) can
 * authenticate through SAML SSO once SAML authentication is enabled, and that the server
 * provisions their account via SAML on first login rather than local auth.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('logs in a directory-only user through Keycloak SAML SSO', {tag: '@saml'}, async ({pw}) => {
    // Ensure prerequisites
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();

    const randomId = getRandomId();
    const keycloakUser = {
        username: `samluser${randomId}`,
        email: `samluser${randomId}@mmtest.com`,
        firstName: `Firstname-${randomId}`,
        lastName: `Lastname-${randomId}`,
        password: 'Password1',
    };

    const keycloakUserId = await pw.createKeycloakUser(keycloakUser);

    try {
        // # Log in through the SAML SSO button, which redirects to Keycloak's hosted login form
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // * Verify the login form reflects SAML being enabled
        await expect(pw.loginPage.samlLoginButton).toBeVisible();
        await pw.loginPage.samlLoginButton.click();

        // Keycloak's own hosted login form.
        await pw.loginPage.page.locator('#username').fill(keycloakUser.username);
        await pw.loginPage.page.locator('#password').fill(keycloakUser.password);
        await pw.loginPage.page.locator('#kc-login').click();

        // * Verify the login succeeded
        await expect(pw.loginPage.page).not.toHaveURL(/\/login/);

        // * Verify the server provisioned the account via SAML, with Keycloak's attributes
        const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
        expect(provisionedUser.auth_service).toBe('saml');
        expect(provisionedUser.email).toBe(keycloakUser.email);
    } finally {
        await pw.deleteKeycloakUser(keycloakUserId);
    }
});
