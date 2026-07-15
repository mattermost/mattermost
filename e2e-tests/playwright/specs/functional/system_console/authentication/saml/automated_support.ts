// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {
    configureSamlWithKeycloak,
    expect,
    KeycloakAdminClient,
    KeycloakLoginPage,
    testConfig,
} from '@mattermost/playwright-lib';
import type {KeycloakUser, PlaywrightClient4, PlaywrightExtended} from '@mattermost/playwright-lib';

export async function configureKeycloakSaml(
    adminClient: PlaywrightClient4,
    signatureAlgorithm: 'RSAwithSHA256' | 'RSAwithSHA512' = 'RSAwithSHA256',
) {
    const keycloak = new KeycloakAdminClient();
    const idpCertificate = await keycloak.configureSamlClient(testConfig.baseURL);
    await configureSamlWithKeycloak(adminClient, {
        baseURL: testConfig.baseURL,
        enableSyncWithLdap: false,
        enableGuestAccess: true,
        guestAttribute: '',
        enableAdminAttribute: false,
        adminAttribute: '',
        signatureAlgorithm,
        idpCertificate,
    });
    return keycloak;
}

export async function verifySignatureAlgorithmLogin(
    pw: PlaywrightExtended,
    page: Page,
    signatureAlgorithm: 'RSAwithSHA256' | 'RSAwithSHA512',
) {
    const {adminClient} = await pw.getAdminClient();
    const keycloak = await configureKeycloakSaml(adminClient, signatureAlgorithm);
    const user = createKeycloakUser(pw, signatureAlgorithm.toLowerCase());
    await keycloak.createUser(user);

    // # Complete an actual browser login through Keycloak using the selected SAML signature setting
    await new KeycloakLoginPage(page).login(user);

    // * Verify Mattermost accepted the assertion and created the authenticated user
    const mattermostUser = await adminClient.getUserByEmail(user.email);
    expect(mattermostUser.email).toBe(user.email);
}

export function createKeycloakUser(pw: PlaywrightExtended, prefix: string): KeycloakUser {
    const id = pw.random.id();
    return {
        username: `saml-${prefix}-${id}`,
        password: 'Password1!',
        email: `saml-${prefix}-${id}@mmtest.com`,
        firstName: 'SAML',
        lastName: prefix,
    };
}
