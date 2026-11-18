// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, expectSignedIn, logInWithKeycloak, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify SAML login succeeds when the SP request-signing algorithm is RSAwithSHA256.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('MM-T3281 SAML login succeeds with signature algorithm RSAwithSHA256', {tag: '@saml'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({SamlSettings: {SignatureAlgorithm: 'RSAwithSHA256'}});

    const keycloakUser = pw.generateKeycloakUser('samlsig256');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through the SAML SSO button
    await logInWithKeycloak(pw, page, 'saml', keycloakUser);

    // * Verify the login succeeded
    await expectSignedIn(page);
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.auth_service).toBe('saml');
});

/**
 * @objective Verify SAML login succeeds when the SP request-signing algorithm is RSAwithSHA512.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('MM-T3281_2 SAML login succeeds with signature algorithm RSAwithSHA512', {tag: '@saml'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({SamlSettings: {SignatureAlgorithm: 'RSAwithSHA512'}});

    const keycloakUser = pw.generateKeycloakUser('samlsig512');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through the SAML SSO button
    await logInWithKeycloak(pw, page, 'saml', keycloakUser);

    // * Verify the login succeeded
    await expectSignedIn(page);
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.auth_service).toBe('saml');
});
