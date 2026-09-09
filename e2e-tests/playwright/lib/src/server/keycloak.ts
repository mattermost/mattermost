// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {AdminConfig} from '@mattermost/types/config';

import {
    KEYCLOAK_ADMIN_PASSWORD,
    KEYCLOAK_ADMIN_USER,
    KEYCLOAK_ALIAS,
    KEYCLOAK_PORT,
    KEYCLOAK_REALM,
} from '../containers/constants';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

export type KeycloakUser = {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
};

async function getAdminToken(): Promise<string> {
    const response = await fetch(`${testConfig.keycloakUrl}/realms/master/protocol/openid-connect/token`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: KEYCLOAK_ADMIN_USER,
            password: KEYCLOAK_ADMIN_PASSWORD,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to get Keycloak admin token: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as {access_token: string};
    return body.access_token;
}

/** Creates the user in Keycloak and returns its Keycloak user id. */
export async function createKeycloakUser(user: KeycloakUser): Promise<string> {
    const token = await getAdminToken();
    const response = await fetch(`${testConfig.keycloakUrl}/admin/realms/${KEYCLOAK_REALM}/users`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            enabled: true,
            credentials: [{type: 'password', value: user.password, temporary: false}],
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to create Keycloak user: ${response.status} ${await response.text()}`);
    }

    const location = response.headers.get('Location');
    const userId = location?.split('/').pop();
    if (!userId) {
        throw new Error('Keycloak user creation response had no Location header to read the new user id from.');
    }
    return userId;
}

export async function deleteKeycloakUser(userId: string): Promise<void> {
    const token = await getAdminToken();
    const response = await fetch(`${testConfig.keycloakUrl}/admin/realms/${KEYCLOAK_REALM}/users/${userId}`, {
        method: 'DELETE',
        headers: {Authorization: `Bearer ${token}`},
    });
    if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete Keycloak user: ${response.status} ${await response.text()}`);
    }
}

// Matches the SAML client's clientId in keycloak-realm-export.json.
const SAML_SERVICE_PROVIDER_ID = 'mattermost';

// The Mattermost server fetches this URL itself (via POST /saml/metadatafromidp), so it must be
// reachable from inside the Testcontainers network — unlike the IdpURL/IdpDescriptorURL below,
// which the browser follows directly and so must be reachable from the host instead. Only the
// certificate from this response is used; its embedded URLs reflect the alias host, not the one
// the browser needs.
function keycloakSamlDescriptorUrl(): string {
    return `http://${KEYCLOAK_ALIAS}:${KEYCLOAK_PORT}/realms/${KEYCLOAK_REALM}/protocol/saml/descriptor`;
}

// The metadata response's certificate is the raw base64 DER content straight out of the SAML
// metadata XML's <X509Certificate> element — no PEM armor — but IdpCertificateFile parsing
// requires a proper PEM block.
function toPemCertificate(base64Der: string): string {
    const lines = base64Der.replace(/\s+/g, '').match(/.{1,64}/g) ?? [];
    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

/**
 * Fetches Keycloak's SAML IdP certificate (via the server's own metadata-from-IdP call) and
 * uploads it, then returns a `SamlSettings` patch pointing the server at Keycloak's SAML IdP and
 * the users `createKeycloakUser` creates.
 */
export async function samlServerConfig(adminClient: Client4): Promise<Partial<AdminConfig['SamlSettings']>> {
    const metadata = await adminClient.getSamlMetadataFromIdp(keycloakSamlDescriptorUrl());
    const certificate = toPemCertificate(metadata.idp_public_certificate);
    await adminClient.uploadIdpSamlCertificate(new File([certificate], 'idp-certificate.crt'));

    return {
        Enable: true,
        Verify: true,
        Encrypt: false,
        SignRequest: false,
        IdpURL: `${testConfig.keycloakUrl}/realms/${KEYCLOAK_REALM}/protocol/saml`,
        IdpDescriptorURL: `${testConfig.keycloakUrl}/realms/${KEYCLOAK_REALM}`,
        ServiceProviderIdentifier: SAML_SERVICE_PROVIDER_ID,
        AssertionConsumerServiceURL: `${testConfig.baseURL}/login/sso/saml`,
        IdAttribute: 'id',
        EmailAttribute: 'email',
        UsernameAttribute: 'username',
        FirstNameAttribute: 'givenName',
        LastNameAttribute: 'surname',
        LoginButtonText: 'Keycloak SAML',
    };
}

/**
 * Checks Keycloak was started this run, points the server's SAML settings at it (fetching its IdP
 * metadata/certificate along the way), and skips the test if either step fails, instead of
 * failing on an unmet precondition.
 */
export async function ensureKeycloak(): Promise<void> {
    if (!testConfig.testcontainersServices.includes('keycloak')) {
        test.skip(true, 'Skipping test - keycloak not started (set PW_TESTCONTAINERS_SERVICES=keycloak)');
        return;
    }

    try {
        const {adminClient} = await getAdminClient();
        const config = await samlServerConfig(adminClient);
        await adminClient.patchConfig({SamlSettings: config});
    } catch (error) {
        test.skip(true, `Skipping test - Keycloak SAML setup failed: ${String(error)}`);
    }
}
