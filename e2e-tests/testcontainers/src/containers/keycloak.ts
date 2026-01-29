// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getKeycloakImage, DEFAULT_CREDENTIALS, INTERNAL_PORTS} from '../config/defaults';
import {KeycloakConnectionInfo} from '../config/types';
import {createFileLogConsumer} from '../utils/log';

// Mattermost realm configuration for Keycloak
// Includes SAML client (mattermost) and OpenID Connect client (mattermost-openid)
const MATTERMOST_REALM = JSON.stringify({
    realm: 'mattermost',
    enabled: true,
    sslRequired: 'none',
    registrationAllowed: false,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    resetPasswordAllowed: false,
    editUsernameAllowed: false,
    bruteForceProtected: false,
    clients: [
        {
            clientId: 'mattermost',
            name: 'Mattermost SAML',
            enabled: true,
            protocol: 'saml',
            publicClient: true,
            frontchannelLogout: true,
            // Permissive defaults - will be updated dynamically after containers start
            // via updateKeycloakSamlClient() with the actual Mattermost URL and port
            rootUrl: '',
            baseUrl: '',
            redirectUris: ['*'],
            webOrigins: ['*'],
            attributes: {
                'saml.assertion.signature': 'false',
                'saml.force.post.binding': 'true',
                'saml.encrypt': 'false',
                'saml.server.signature': 'false',
                'saml.client.signature': 'false',
                'saml.authnstatement': 'true',
                saml_name_id_format: 'email',
                saml_force_name_id_format: 'true',
            },
            protocolMappers: [
                {
                    name: 'email',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'email',
                        'friendly.name': 'email',
                        'attribute.name': 'email',
                        'attribute.nameformat': 'Basic',
                    },
                },
                {
                    name: 'firstName',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'firstName',
                        'friendly.name': 'firstName',
                        'attribute.name': 'firstName',
                        'attribute.nameformat': 'Basic',
                    },
                },
                {
                    name: 'lastName',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'lastName',
                        'friendly.name': 'lastName',
                        'attribute.name': 'lastName',
                        'attribute.nameformat': 'Basic',
                    },
                },
                {
                    name: 'username',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'username',
                        'friendly.name': 'username',
                        'attribute.name': 'username',
                        'attribute.nameformat': 'Basic',
                    },
                },
                {
                    name: 'id',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'id',
                        'friendly.name': 'id',
                        'attribute.name': 'id',
                        'attribute.nameformat': 'Basic',
                    },
                },
            ],
        },
        {
            clientId: 'mattermost-openid',
            name: 'Mattermost OpenID Connect',
            enabled: true,
            protocol: 'openid-connect',
            publicClient: false,
            secret: 'mattermost-openid-secret',
            standardFlowEnabled: true,
            directAccessGrantsEnabled: true,
            serviceAccountsEnabled: true,
            redirectUris: ['*'],
            webOrigins: ['*'],
            attributes: {
                'post.logout.redirect.uris': '*',
            },
        },
    ],
    users: [
        {
            username: 'user-1',
            email: 'user-1@sample.mattermost.com',
            firstName: 'User',
            lastName: 'One',
            enabled: true,
            emailVerified: true,
            credentials: [{type: 'password', value: 'Password1!', temporary: false}],
        },
        {
            username: 'user-2',
            email: 'user-2@sample.mattermost.com',
            firstName: 'User',
            lastName: 'Two',
            enabled: true,
            emailVerified: true,
            credentials: [{type: 'password', value: 'Password1!', temporary: false}],
        },
    ],
});

export interface KeycloakConfig {
    image?: string;
    adminUser?: string;
    adminPassword?: string;
}

export async function createKeycloakContainer(
    network: StartedNetwork,
    config: KeycloakConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getKeycloakImage();
    const adminUser = config.adminUser ?? DEFAULT_CREDENTIALS.keycloak.adminUser;
    const adminPassword = config.adminPassword ?? DEFAULT_CREDENTIALS.keycloak.adminPassword;

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('keycloak')
        .withEnvironment({
            KEYCLOAK_ADMIN: adminUser,
            KEYCLOAK_ADMIN_PASSWORD: adminPassword,
            KC_HOSTNAME_STRICT: 'false',
            KC_HOSTNAME_STRICT_HTTPS: 'false',
            KC_HTTP_ENABLED: 'true',
        })
        .withCopyContentToContainer([
            {content: MATTERMOST_REALM, target: '/opt/keycloak/data/import/mattermost-realm.json'},
        ])
        .withCommand(['start-dev', '--import-realm', '--health-enabled=true'])
        .withExposedPorts(INTERNAL_PORTS.keycloak)
        .withLogConsumer(createFileLogConsumer('keycloak'))
        .withWaitStrategy(Wait.forHttp('/health/ready', INTERNAL_PORTS.keycloak).withStartupTimeout(120_000))
        .start();

    return container;
}

export function getKeycloakConnectionInfo(container: StartedTestContainer, image: string): KeycloakConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.keycloak);

    return {
        host,
        port,
        adminUrl: `http://${host}:${port}/admin`,
        realmUrl: `http://${host}:${port}/realms/mattermost`,
        image,
    };
}
