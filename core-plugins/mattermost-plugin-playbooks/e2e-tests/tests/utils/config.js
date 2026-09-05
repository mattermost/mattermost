// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getKeycloakServerSettings() {
    const baseUrl = Cypress.config('baseUrl');
    const {keycloakBaseUrl, keycloakAppName} = Cypress.env();
    const idpDescriptorUrl = `${keycloakBaseUrl}/auth/realms/${keycloakAppName}`;
    const idpUrl = `${idpDescriptorUrl}/protocol/saml`;

    return {
        SamlSettings: {
            Enable: true,
            Encrypt: false,
            IdpURL: idpUrl,
            IdpDescriptorURL: idpDescriptorUrl,
            ServiceProviderIdentifier: `${baseUrl}/login/sso/saml`,
            AssertionConsumerServiceURL: `${baseUrl}/login/sso/saml`,
            SignatureAlgorithm: 'RSAwithSHA256',
            PublicCertificateFile: '',
            PrivateKeyFile: '',
            FirstNameAttribute: 'firstName',
            LastNameAttribute: 'lastName',
            EmailAttribute: 'email',
            UsernameAttribute: 'username',
            EnableSyncWithLdap: true,
            EnableSyncWithLdapIncludeAuth: true,
            IdAttribute: 'username',
        },
        LdapSettings: {
            EnableSync: true,
            BaseDN: 'ou=e2etest,dc=mm,dc=test,dc=com',
        },
    };
}
