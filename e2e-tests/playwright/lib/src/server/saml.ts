// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import type {PlaywrightClient4} from './playwright_client';

import {testConfig} from '@/test_config';

type SamlOptions = {
    baseURL: string;
    enableSyncWithLdap: boolean;
    enableGuestAccess?: boolean;
    guestAttribute?: string;
    enableAdminAttribute?: boolean;
    adminAttribute?: string;
    signatureAlgorithm?: 'RSAwithSHA256' | 'RSAwithSHA512';
    keycloakUrl?: string;
    keycloakRealm?: string;
    idpCertificate?: string;
};

/**
 * Configures Mattermost SAML against the Keycloak realm supplied by E2E Docker.
 */
export async function configureSamlWithKeycloak(client: PlaywrightClient4, options: SamlOptions) {
    const keycloakUrl = (options.keycloakUrl || testConfig.keycloakUrl).replace(/\/$/, '');
    const keycloakRealm = options.keycloakRealm || testConfig.keycloakRealm;
    const mattermostBaseURL = options.baseURL.replace(/\/$/, '');
    const descriptorURL = `${keycloakUrl}/realms/${keycloakRealm}`;

    await client.configureOpenLdap();
    await client.resetOpenLdapTestState();
    await client.uploadIdpSamlCertificate(readKeycloakCertificate(options.idpCertificate));
    await client.patchConfig({
        SamlSettings: {
            Enable: true,
            Encrypt: false,
            SignRequest: false,
            IdpURL: `${descriptorURL}/protocol/saml`,
            IdpDescriptorURL: descriptorURL,
            ServiceProviderIdentifier: 'mattermost',
            AssertionConsumerServiceURL: `${mattermostBaseURL}/login/sso/saml`,
            SignatureAlgorithm: 'RSAwithSHA256',
            CanonicalAlgorithm: 'Canonical1.0',
            PublicCertificateFile: '',
            PrivateKeyFile: '',
            FirstNameAttribute: 'urn:oid:2.5.4.42',
            LastNameAttribute: 'urn:oid:2.5.4.4',
            EmailAttribute: 'urn:oid:1.2.840.113549.1.9.1',
            UsernameAttribute: 'username',
            IdAttribute: 'username',
            ...(options.guestAttribute === undefined ? {} : {GuestAttribute: options.guestAttribute}),
            ...(options.enableAdminAttribute === undefined ? {} : {EnableAdminAttribute: options.enableAdminAttribute}),
            ...(options.adminAttribute === undefined ? {} : {AdminAttribute: options.adminAttribute}),
            ...(options.signatureAlgorithm === undefined ? {} : {SignatureAlgorithm: options.signatureAlgorithm}),
            EnableSyncWithLdap: options.enableSyncWithLdap,
            EnableSyncWithLdapIncludeAuth: options.enableSyncWithLdap,
        },
        ...(options.enableGuestAccess === undefined
            ? {}
            : {GuestAccountsSettings: {Enable: options.enableGuestAccess}}),
        LdapSettings: {
            EnableSync: true,
            BaseDN: 'ou=e2etest,dc=mm,dc=test,dc=com',
        },
    });
}

function readKeycloakCertificate(certificate?: string) {
    if (certificate) {
        const lines = certificate.match(/.{1,64}/g)?.join('\n');
        return new File([`-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----\n`], 'keycloak.crt');
    }
    const candidates = [
        path.resolve(process.cwd(), '../../server/build/docker/keycloak/keycloak.crt'),
        path.resolve(process.cwd(), 'server/build/docker/keycloak/keycloak.crt'),
    ];
    const certificatePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!certificatePath) {
        throw new Error(`Keycloak certificate was not found in: ${candidates.join(', ')}`);
    }
    return new File([fs.readFileSync(certificatePath)], path.basename(certificatePath));
}
