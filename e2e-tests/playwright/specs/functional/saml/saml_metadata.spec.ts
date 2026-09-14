// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the SAML metadata endpoint returns valid XML when encryption is disabled.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL.
 */
test('MM-T3012 SAML metadata endpoint responds with XML when encryption is disabled', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    try {
        await pw.ensureKeycloak();
        await adminClient.patchConfig({SamlSettings: {Encrypt: false}});

        // # Fetch the SAML SP metadata document
        const response = await fetch(`${adminClient.getBaseRoute()}/saml/metadata`);
        const body = await response.text();

        // * Verify the server returned a well-formed metadata document
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/xml');
        expect(body.startsWith('<?xml version')).toBe(true);
    } finally {
        await adminClient.patchConfig({SamlSettings: originalConfig.SamlSettings});
    }
});

/**
 * @objective Verify fetching SAML IdP metadata succeeds against a real IdP descriptor URL and
 * fails against an unreachable one.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL.
 */
test(
    'SAML IdP metadata fetch succeeds for a reachable IdP and fails for an unreachable one',
    {tag: '@saml'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.getAdminClient();
        const originalConfig = await adminClient.getConfig();
        try {
            await pw.ensureKeycloak();

            // # Fetch metadata from Keycloak's real SAML descriptor
            const metadata = await adminClient.getSamlMetadataFromIdp(pw.keycloakSamlDescriptorUrl());

            // * Verify the fetch succeeds
            expect(metadata.idp_public_certificate.length).toBeGreaterThan(0);

            // * Verify fetching metadata from an unreachable IdP fails
            await expect(
                adminClient.getSamlMetadataFromIdp('http://unreachable-idp.invalid/descriptor'),
            ).rejects.toThrow();
        } finally {
            await adminClient.patchConfig({SamlSettings: originalConfig.SamlSettings});
        }
    },
);
