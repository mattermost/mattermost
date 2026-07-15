// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {testConfig} from '@/test_config';

export type KeycloakUser = {
    username: string;
    password: string;
    email: string;
    firstName: string;
    lastName: string;
    attributes?: Record<string, string[]>;
};

type KeycloakUserRepresentation = {
    id: string;
};

type KeycloakClientRepresentation = {
    id: string;
    attributes?: Record<string, string>;
    [key: string]: unknown;
};

type KeycloakProtocolMapperRepresentation = {
    id?: string;
    name: string;
};

/**
 * Minimal Keycloak admin client for the realm bundled with the E2E services.
 */
export class KeycloakAdminClient {
    readonly baseURL: string;
    readonly adminUsername: string;
    readonly adminPassword: string;
    readonly realm: string;

    constructor(
        baseURL = testConfig.keycloakUrl,
        adminUsername = testConfig.keycloakAdminUsername,
        adminPassword = testConfig.keycloakAdminPassword,
        realm = testConfig.keycloakRealm,
    ) {
        this.baseURL = baseURL.replace(/\/$/, '');
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        this.realm = realm;
    }

    async configureSamlClient(mattermostBaseURL: string, userAttributeNames: string[] = []) {
        const token = await this.getAccessToken();
        const clients = await this.request<KeycloakClientRepresentation[]>(
            `/admin/realms/${this.realm}/clients?clientId=mattermost`,
            {method: 'GET', token, expectedStatus: 200},
        );
        const client = clients[0];
        if (!client) {
            throw new Error('Keycloak SAML client mattermost was not found');
        }
        const baseURL = mattermostBaseURL.replace(/\/$/, '');
        await this.request(`/admin/realms/${this.realm}/clients/${client.id}`, {
            method: 'PUT',
            token,
            body: {
                ...client,
                rootUrl: baseURL,
                baseUrl: baseURL,
                redirectUris: [`${baseURL}/login/sso/saml`],
                webOrigins: [baseURL],
                attributes: {
                    ...client.attributes,
                    'saml.assertion.signature': 'true',
                    'saml.server.signature': 'true',
                },
            },
            expectedStatus: 204,
        });
        for (const attributeName of userAttributeNames) {
            await this.configureSamlUserAttributeMapper(token, client.id, attributeName);
        }
        return this.getRealmSigningCertificate();
    }

    async createUser(user: KeycloakUser) {
        const token = await this.getAccessToken();
        const existingUser = await this.findUser(token, user.email);
        if (existingUser) {
            await this.request(`/admin/realms/${this.realm}/users/${existingUser.id}`, {
                method: 'DELETE',
                token,
                expectedStatus: 204,
            });
        }

        await this.request(`/admin/realms/${this.realm}/users`, {
            method: 'POST',
            token,
            body: {
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                attributes: user.attributes,
                enabled: true,
            },
            expectedStatus: 201,
        });

        const createdUser = await this.findUser(token, user.email);
        if (!createdUser) {
            throw new Error(`Keycloak user ${user.email} was not created`);
        }

        await this.request(`/admin/realms/${this.realm}/users/${createdUser.id}/reset-password`, {
            method: 'PUT',
            token,
            body: {type: 'password', temporary: false, value: user.password},
            expectedStatus: 204,
        });
        return createdUser;
    }

    private async configureSamlUserAttributeMapper(token: string, clientId: string, attributeName: string) {
        const mappers = await this.request<KeycloakProtocolMapperRepresentation[]>(
            `/admin/realms/${this.realm}/clients/${clientId}/protocol-mappers/models`,
            {method: 'GET', token, expectedStatus: 200},
        );
        const mapper = {
            name: `Mattermost ${attributeName}`,
            protocol: 'saml',
            protocolMapper: 'saml-user-attribute-mapper',
            consentRequired: false,
            config: {
                'user.attribute': attributeName,
                'attribute.name': attributeName,
                'attribute.nameformat': 'Basic',
            },
        };
        const existingMapper = mappers.find((candidate) => candidate.name === mapper.name);
        if (existingMapper?.id) {
            await this.request(
                `/admin/realms/${this.realm}/clients/${clientId}/protocol-mappers/models/${existingMapper.id}`,
                {method: 'PUT', token, body: {...mapper, id: existingMapper.id}, expectedStatus: 204},
            );
            return;
        }

        await this.request(`/admin/realms/${this.realm}/clients/${clientId}/protocol-mappers/models`, {
            method: 'POST',
            token,
            body: mapper,
            expectedStatus: 201,
        });
    }

    async setUserEnabled(email: string, enabled: boolean) {
        const token = await this.getAccessToken();
        const user = await this.findUser(token, email);
        if (!user) {
            throw new Error(`Keycloak user ${email} was not found`);
        }

        await this.request(`/admin/realms/${this.realm}/users/${user.id}`, {
            method: 'PUT',
            token,
            body: {enabled},
            expectedStatus: 204,
        });
    }

    private async getAccessToken() {
        const body = new URLSearchParams({
            grant_type: 'password',
            username: this.adminUsername,
            password: this.adminPassword,
            client_id: 'admin-cli',
        });
        const response = await fetch(`${this.baseURL}/realms/master/protocol/openid-connect/token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body,
        });
        if (!response.ok) {
            throw new Error(`Keycloak token request failed with status ${response.status}: ${await response.text()}`);
        }
        const result = (await response.json()) as {access_token: string};
        return result.access_token;
    }

    private async getRealmSigningCertificate() {
        const response = await fetch(`${this.baseURL}/realms/${this.realm}/protocol/openid-connect/certs`);
        if (!response.ok) {
            throw new Error(`Keycloak certificate request failed with status ${response.status}`);
        }
        const result = (await response.json()) as {
            keys: Array<{use?: string; alg?: string; x5c?: string[]}>;
        };
        const certificate = result.keys.find((key) => key.use === 'sig' && key.alg === 'RS256')?.x5c?.[0];
        if (!certificate) {
            throw new Error(`Keycloak realm ${this.realm} has no active RS256 signing certificate`);
        }
        return certificate;
    }

    private async findUser(token: string, email: string) {
        const users = await this.request<KeycloakUserRepresentation[]>(
            `/admin/realms/${this.realm}/users?exact=true&email=${encodeURIComponent(email)}`,
            {method: 'GET', token, expectedStatus: 200},
        );
        return users[0];
    }

    private async request<T = void>(
        path: string,
        options: {
            method: 'GET' | 'POST' | 'PUT' | 'DELETE';
            token: string;
            body?: unknown;
            expectedStatus: number;
        },
    ): Promise<T> {
        const response = await fetch(`${this.baseURL}${path}`, {
            method: options.method,
            headers: {
                Authorization: `Bearer ${options.token}`,
                ...(options.body ? {'Content-Type': 'application/json'} : {}),
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        if (response.status !== options.expectedStatus) {
            throw new Error(
                `Keycloak ${options.method} ${path} failed with status ${response.status}: ${await response.text()}`,
            );
        }
        return response.status === 200 ? ((await response.json()) as T) : (undefined as T);
    }
}
