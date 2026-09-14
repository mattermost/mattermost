// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user who only exists in Keycloak is provisioned via SAML SSO on first login
 * and can reach a team channel once granted membership.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('logs in a directory-only user through Keycloak SAML SSO', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    try {
        await pw.ensureKeycloak();

        const team = await pw.createNewTeam(adminClient);
        const keycloakUser = pw.generateKeycloakUser('samluser');
        await pw.createKeycloakUser(keycloakUser);

        // # Log in through the SAML SSO button
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await expect(pw.loginPage.samlLoginButton).toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

        // * Verify the server provisioned the account via SAML
        await pw.loginPage.expectNotOnLoginPage();
        const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
        expect(provisionedUser.auth_service).toBe('saml');
        expect(provisionedUser.email).toBe(keycloakUser.email);

        // # Grant team membership and open a channel
        await adminClient.addToTeam(team.id, provisionedUser.id);
        await pw.channelsPage.goto(team.name);

        // * Verify the user lands on a real channel
        await pw.channelsPage.toBeVisible();
    } finally {
        await adminClient.patchConfig({SamlSettings: originalConfig.SamlSettings});
    }
});

/**
 * @objective Verify a Keycloak user suspended via the admin API cannot authenticate through SAML.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('suspended Keycloak user cannot log in via SAML', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    try {
        await pw.ensureKeycloak();

        const keycloakUser = pw.generateKeycloakUser('samlsuspended');
        const keycloakUserId = await pw.createKeycloakUser(keycloakUser);
        await pw.suspendKeycloakUser(keycloakUserId);

        // # Submit valid credentials for the suspended user
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

        // * Verify Keycloak keeps the user on its disabled-account page
        await expect(pw.keycloakLoginPage.accountDisabledMessage).toBeVisible();

        // * Verify no Mattermost account was created
        await expect(adminClient.getUserByUsername(keycloakUser.username)).rejects.toThrow();
    } finally {
        await adminClient.patchConfig({SamlSettings: originalConfig.SamlSettings});
    }
});

/**
 * @objective Verify a SAML login records an audit trail entry for the provisioning event.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('MM-T3280 SAML login records an audit trail entry', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    try {
        await pw.ensureKeycloak();

        const keycloakUser = pw.generateKeycloakUser('samlaudit');
        await pw.createKeycloakUser(keycloakUser);

        // # Log in through the SAML SSO button
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);
        await pw.loginPage.expectNotOnLoginPage();

        // * Verify the server's audit trail recorded the SAML provisioning event
        const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
        const audits = await adminClient.getUserAudits(provisionedUser.id);
        expect(
            audits.some((audit) => audit.action.includes('/login/sso/saml') && audit.extra_info === 'obtained user'),
        ).toBe(true);
    } finally {
        await adminClient.patchConfig({SamlSettings: originalConfig.SamlSettings});
    }
});
