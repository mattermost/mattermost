// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {AdminConfig} from '@mattermost/types/config';

import {
    KEYCLOAK_ADMIN_PASSWORD,
    KEYCLOAK_ADMIN_USER,
    KEYCLOAK_ALIAS,
    KEYCLOAK_OPENID_CLIENT_ID,
    KEYCLOAK_OPENID_CLIENT_SECRET,
    KEYCLOAK_PORT,
    KEYCLOAK_REALM,
} from '../containers/constants';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';
import {getRandomId} from '@/util';

export type KeycloakUser = {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
};

/** Generates a directory-only Keycloak user's fields - createKeycloakUser() still creates it. */
export function generateKeycloakUser(prefix = 'user'): KeycloakUser {
    const randomId = getRandomId();
    return {
        username: `${prefix}${randomId}`,
        email: `${prefix}${randomId}@mmtest.com`,
        firstName: `Firstname-${randomId}`,
        lastName: `Lastname-${randomId}`,
        password: 'Password1',
    };
}

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

/** Disables the Keycloak user (`enabled: false`), so Keycloak itself refuses further logins. */
export async function suspendKeycloakUser(userId: string): Promise<void> {
    const token = await getAdminToken();
    const response = await fetch(`${testConfig.keycloakUrl}/admin/realms/${KEYCLOAK_REALM}/users/${userId}`, {
        method: 'PUT',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({enabled: false}),
    });
    if (!response.ok) {
        throw new Error(`Failed to suspend Keycloak user: ${response.status} ${await response.text()}`);
    }
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

// Fetched by the server itself, so this must resolve inside the Testcontainers network — unlike
// IdpURL/IdpDescriptorURL below, which the browser follows directly.
export function keycloakSamlDescriptorUrl(): string {
    return `http://${KEYCLOAK_ALIAS}:${KEYCLOAK_PORT}/realms/${KEYCLOAK_REALM}/protocol/saml/descriptor`;
}

// The metadata response's certificate is raw base64 DER with no PEM armor, but
// IdpCertificateFile parsing requires a proper PEM block.
function toPemCertificate(base64Der: string): string {
    const lines = base64Der.replace(/\s+/g, '').match(/.{1,64}/g) ?? [];
    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

/** Fetches and uploads Keycloak's SAML IdP certificate, then returns a `SamlSettings` patch pointing at it. */
export async function samlServerConfig(adminClient: Client4): Promise<Partial<AdminConfig['SamlSettings']>> {
    const metadata = await adminClient.getSamlMetadataFromIdp(keycloakSamlDescriptorUrl());
    const certificate = toPemCertificate(metadata.idp_public_certificate);
    await adminClient.uploadIdpSamlCertificate(new File([certificate], 'idp-certificate.crt'));

    return {
        Enable: true,
        Verify: true,
        Encrypt: false,
        SignRequest: false,
        // Reset explicitly: a prior test (e.g. saml_ldap_sync.spec.ts) may have turned this on,
        // and with it on a SAML user absent from LDAP fails to log in at all.
        EnableSyncWithLdap: false,
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

/** Points the server's SAML settings at Keycloak. Skips only if Keycloak wasn't requested. */
export async function ensureKeycloak(): Promise<void> {
    if (!testConfig.testcontainersServices.includes('keycloak')) {
        test.skip(true, 'Skipping test - keycloak not started (set PW_TESTCONTAINERS_SERVICES=keycloak)');
        return;
    }

    const {adminClient} = await getAdminClient();
    const config = await samlServerConfig(adminClient);
    await adminClient.patchConfig({SamlSettings: config});
}

/**
 * Pins the realm's issuer to the host-reachable Keycloak URL. Otherwise Keycloak
 * (KC_HOSTNAME_STRICT=false) ties token validity to whichever hostname received the request, and
 * AuthEndpoint (host-reachable) vs. TokenEndpoint/UserAPIEndpoint (Testcontainers alias, below)
 * differ, which would fail the userinfo call with `invalid_token`.
 */
async function ensureKeycloakRealmFrontendUrl(): Promise<void> {
    const token = await getAdminToken();
    const realmUrl = `${testConfig.keycloakUrl}/admin/realms/${KEYCLOAK_REALM}`;

    const response = await fetch(realmUrl, {headers: {Authorization: `Bearer ${token}`}});
    if (!response.ok) {
        throw new Error(`Failed to read Keycloak realm: ${response.status} ${await response.text()}`);
    }
    const realm = await response.json();

    if (realm.attributes?.frontendUrl === testConfig.keycloakUrl) {
        return;
    }

    realm.attributes = {...realm.attributes, frontendUrl: testConfig.keycloakUrl};
    const putResponse = await fetch(realmUrl, {
        method: 'PUT',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify(realm),
    });
    if (!putResponse.ok) {
        throw new Error(`Failed to set Keycloak realm frontend URL: ${putResponse.status} ${await putResponse.text()}`);
    }
}

/**
 * Points the server at the `mattermost-openid` client provisioned in keycloak-realm-export.json.
 * AuthEndpoint is browser-facing while TokenEndpoint/UserAPIEndpoint are called by the server
 * itself, so they use the Testcontainers alias (see ensureKeycloakRealmFrontendUrl()).
 * DiscoveryEndpoint is left empty since setting it would let the server resolve endpoints from
 * it instead, bypassing this split.
 */
export function openidServerConfig(): Partial<AdminConfig['OpenIdSettings']> {
    return {
        Enable: true,
        Id: KEYCLOAK_OPENID_CLIENT_ID,
        Secret: KEYCLOAK_OPENID_CLIENT_SECRET,
        Scope: 'openid profile email',
        AuthEndpoint: `${testConfig.keycloakUrl}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`,
        TokenEndpoint: `http://${KEYCLOAK_ALIAS}:${KEYCLOAK_PORT}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
        UserAPIEndpoint: `http://${KEYCLOAK_ALIAS}:${KEYCLOAK_PORT}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
        DiscoveryEndpoint: '',
        ButtonText: 'Keycloak OpenID',
        UsePreferredUsername: true,
    };
}

/** Points the server's OpenID settings at Keycloak. Skips only if Keycloak wasn't requested. */
export async function ensureKeycloakOpenId(): Promise<void> {
    if (!testConfig.testcontainersServices.includes('keycloak')) {
        test.skip(true, 'Skipping test - keycloak not started (set PW_TESTCONTAINERS_SERVICES=keycloak)');
        return;
    }

    await ensureKeycloakRealmFrontendUrl();
    const {adminClient} = await getAdminClient();
    await adminClient.patchConfig({OpenIdSettings: openidServerConfig()});
}
