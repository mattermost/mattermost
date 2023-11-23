// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *****************************************************************************
// Keycloak Admin REST API
// https://www.keycloak.org/documentation
// *****************************************************************************

import realmJson from './keycloak_realm.json';

const {
    keycloakBaseUrl,
    keycloakAppName,
    keycloakUsername,
    keycloakPassword,
} = Cypress.env();

Cypress.Commands.add('apiKeycloakGetAccessToken', () => {
    return cy.task('keycloakRequest', {
        baseUrl: `${keycloakBaseUrl}/auth/realms/master/protocol/openid-connect/token`,
        method: 'POST',
        headers: {'Content-type': 'application/x-www-form-urlencoded'},
        data: `grant_type=password&username=${keycloakUsername}&password=${keycloakPassword}&client_id=admin-cli`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        const token = response.data.access_token;
        return cy.wrap(token);
    });
});

function getRealmJson() {
    const baseUrl = Cypress.config('baseUrl');
    const {ldapServer, ldapPort} = Cypress.env();

    const realm = JSON.stringify(realmJson).
        replace(/localhost:389/g, `${ldapServer}:${ldapPort}`).
        replace(/http:\/\/localhost:8065/g, baseUrl);
    return JSON.parse(realm);
}

Cypress.Commands.add('apiKeycloakSaveRealm', (accessToken, failOnStatusCode = true) => {
    const realm = getRealmJson();

    return cy.task('keycloakRequest', {
        baseUrl: `${keycloakBaseUrl}/auth/admin/realms`,
        method: 'POST',
        data: realm,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((response) => {
        if (failOnStatusCode) {
            expect(response.status).to.equal(201);
        }

        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiKeycloakGetRealm', (accessToken, failOnStatusCode = true) => {
    return cy.task('keycloakRequest', {
        baseUrl: `${keycloakBaseUrl}/auth/admin/realms/${keycloakAppName}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        failOnStatusCode,
    }).then((response) => {
        if (failOnStatusCode) {
            expect(response.status).to.equal(200);
        }

        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiRequireKeycloak', () => {
    cy.apiKeycloakGetAccessToken().then((token) => {
        cy.apiKeycloakGetRealm(token, false).then((response) => {
            if (response.status !== 200) {
                return cy.apiKeycloakSaveRealm(token);
            }

            return response;
        });
    });
});
