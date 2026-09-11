// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user who only exists in Keycloak (never created in Mattermost) can
 * authenticate through SAML SSO once SAML authentication is enabled, that the server provisions
 * their account via SAML on first login rather than local auth, and that they can reach a real
 * channel once they have team membership.
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
    // A directory-only user has no team until one is granted after they're provisioned below.
    const team = await pw.createNewTeam(adminClient);

    const keycloakUser = pw.generateKeycloakUser('samluser');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through the SAML SSO button, which redirects to Keycloak's hosted login form
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Verify the login form reflects SAML being enabled
    await expect(pw.loginPage.samlLoginButton).toBeVisible();
    await pw.loginPage.samlLoginButton.click();

    // Keycloak's own hosted login form
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify the login succeeded
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);

    // * Verify the server provisioned the account via SAML, with Keycloak's attributes
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.auth_service).toBe('saml');
    expect(provisionedUser.email).toBe(keycloakUser.email);

    // # Grant team membership (the SAML user had none) and reach its channel
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await pw.channelsPage.goto(team.name);

    // * Verify the user lands on a real channel, not stuck on team selection
    await pw.channelsPage.toBeVisible();
});

/**
 * @objective Verify a Keycloak user suspended via the admin API (`enabled: false`) cannot
 * authenticate through SAML SSO, and no Mattermost session is created.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('suspended Keycloak user cannot log in via SAML', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    const keycloakUser = pw.generateKeycloakUser('samlsuspended');
    const keycloakUserId = await pw.createKeycloakUser(keycloakUser);
    await pw.suspendKeycloakUser(keycloakUserId);

    // # Click the SAML button, then submit valid credentials for the now-suspended user
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify Keycloak rejects the login and keeps the user on its own login page
    await expect(pw.keycloakLoginPage.accountDisabledMessage).toBeVisible();

    // * Verify no Mattermost account was created
    await expect(adminClient.getUserByUsername(keycloakUser.username)).rejects.toThrow();
});

/**
 * @objective Verify a SAML login records an audit trail entry for the provisioning event.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('SAML login records an audit trail entry', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    const keycloakUser = pw.generateKeycloakUser('samlaudit');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through the SAML SSO button
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);

    // * Verify the server's audit trail recorded the SAML provisioning event
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    const audits = await adminClient.getUserAudits(provisionedUser.id);
    expect(
        audits.some((audit) => audit.action.includes('/login/sso/saml') && audit.extra_info === 'obtained user'),
    ).toBe(true);
});

/**
 * @objective Verify the SAML metadata endpoint returns valid XML when encryption is disabled.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL.
 */
test('SAML metadata endpoint responds with XML when encryption is disabled', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({SamlSettings: {Encrypt: false}});

    // # Fetch the SAML SP metadata document
    const response = await fetch(`${adminClient.getBaseRoute()}/saml/metadata`);
    const body = await response.text();

    // * Verify the server returned a well-formed metadata document
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body.startsWith('<?xml version')).toBe(true);
});

/**
 * @objective Verify SAML login still succeeds when the SP's request-signing algorithm is set to
 * a non-default value.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
for (const signatureAlgorithm of ['RSAwithSHA256', 'RSAwithSHA512']) {
    test(`SAML login succeeds with signature algorithm ${signatureAlgorithm}`, {tag: '@saml'}, async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.ensureKeycloak();

        const {adminClient} = await pw.getAdminClient();
        await adminClient.patchConfig({SamlSettings: {SignatureAlgorithm: signatureAlgorithm}});

        const keycloakUser = pw.generateKeycloakUser('samlsig');
        await pw.createKeycloakUser(keycloakUser);

        // # Log in through the SAML SSO button
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

        // * Verify the login succeeded
        await expect(pw.loginPage.page).not.toHaveURL(/\/login/);
        const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
        expect(provisionedUser.auth_service).toBe('saml');
    });
}

/**
 * @objective Verify fetching SAML IdP metadata succeeds against a real, reachable IdP descriptor
 * URL, and fails against an unreachable one.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL.
 */
test(
    'SAML IdP metadata fetch succeeds for a reachable IdP and fails for an unreachable one',
    {tag: '@saml'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.ensureKeycloak();

        const {adminClient} = await pw.getAdminClient();

        // # Fetch metadata from Keycloak's real SAML descriptor
        const metadata = await adminClient.getSamlMetadataFromIdp(pw.keycloakSamlDescriptorUrl());

        // * Verify the fetch succeeds
        expect(metadata.idp_public_certificate.length).toBeGreaterThan(0);

        // * Verify fetching metadata from an unreachable IdP fails
        await expect(adminClient.getSamlMetadataFromIdp('http://unreachable-idp.invalid/descriptor')).rejects.toThrow();
    },
);

/**
 * @objective Verify a directory user that doesn't match SamlSettings.GuestAttribute is
 * provisioned as a regular Mattermost member on first SAML login.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('SAML login provisions a member when the guest attribute does not match', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({
        GuestAccountsSettings: {Enable: true},
        SamlSettings: {GuestAttribute: 'username=no-such-user'},
    });

    const keycloakUser = pw.generateKeycloakUser('samlmember');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in via SAML with a user that doesn't match the guest attribute filter
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify the login succeeded and the user was provisioned as a regular member, not a guest
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.roles.split(' ')).not.toContain('system_guest');
});

/**
 * @objective Verify a directory user matching SamlSettings.GuestAttribute is provisioned as a
 * Mattermost guest on first SAML login.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('SAML guest attribute provisions the user as a guest', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    const keycloakUser = pw.generateKeycloakUser('samlguest');
    await pw.createKeycloakUser(keycloakUser);
    await adminClient.patchConfig({
        GuestAccountsSettings: {Enable: true},
        SamlSettings: {GuestAttribute: `username=${keycloakUser.username}`},
    });

    // # Log in via SAML with a user that matches the guest attribute filter
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify the login succeeded and the user was provisioned as a guest
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_guest');
});
