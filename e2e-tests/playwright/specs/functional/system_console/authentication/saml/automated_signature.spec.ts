// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {verifySignatureAlgorithmLogin} from './automated_support';

test.describe('SAML automated signature behaviors', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify a Keycloak SAML login succeeds with the RSA SHA-256 signature algorithm configured
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('MM-T3281 - SAML Signature Algorithm using RSAwithSHA256', {tag: '@saml'}, async ({pw, page}) => {
        // # Configure RSA SHA-256 and complete a Keycloak SAML login
        await verifySignatureAlgorithmLogin(pw, page, 'RSAwithSHA256');
        // * Verify Mattermost accepts the authenticated user
    });

    /**
     * @objective Verify a Keycloak SAML login succeeds with the RSA SHA-512 signature algorithm configured
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('SAML Signature Algorithm using RSAwithSHA512', {tag: '@saml'}, async ({pw, page}) => {
        // # Configure RSA SHA-512 and complete a Keycloak SAML login
        await verifySignatureAlgorithmLogin(pw, page, 'RSAwithSHA512');
        // * Verify Mattermost accepts the authenticated user
    });
});
