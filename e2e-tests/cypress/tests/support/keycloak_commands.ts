// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from 'tests/types';
import {LdapUser} from './ldap_server_commands';
import * as TIMEOUTS from '../fixtures/timeouts';

const {
    keycloakBaseUrl,
    keycloakAppName,
} = Cypress.env();

const baseUrl = `${keycloakBaseUrl}/auth/admin/realms/${keycloakAppName}`;
const loginUrl = `${keycloakBaseUrl}/auth/realms/master/protocol/openid-connect/token`;

function buildProfile(user) {
    return {
        firstName: user.firstname,
        lastName: user.lastname,
        email: user.email,
        username: user.username,
        enabled: true,
    };
}

/**
* keycloakGetAccessTokenAPI is a task wrapped as command with post-verification
* that an Access Token is successfully retrieved
* @returns {string} - access token
*/
function keycloakGetAccessTokenAPI(): ChainableT<string> {
    return cy.task('keycloakRequest', {
        baseUrl: loginUrl,
        path: '',
        method: 'post',
        headers: {'Content-type': 'application/x-www-form-urlencoded'},
        data: 'grant_type=password&username=mmuser&password=mostest&client_id=admin-cli',
    }).then((response: any) => {
        expect(response.status).to.equal(200);
        const token: string = response.data.access_token;
        return cy.wrap(token);
    });
}

Cypress.Commands.add('keycloakGetAccessTokenAPI', keycloakGetAccessTokenAPI);

/**
* keycloakCreateUserAPI is a task wrapped as command with post-verification
* that a user is successfully created in keycloak
* @param {string} accessToken - a valid access token
* @param {object} user - a keycloak user object to create
*
* @example
*   cy.keycloakCreateUserAPI('abcde', {firstName: 'test', lastName: 'test', email: 'test', username: 'test', enabled: true,});
*/
function keycloakCreateUserAPI(accessToken: string, user: any = {}): ChainableT {
    const profile = buildProfile(user);
    return cy.task('keycloakRequest', {
        baseUrl,
        path: 'users',
        method: 'post',
        data: profile,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((response: Response) => {
        expect(response.status).to.equal(201);
    });
}

Cypress.Commands.add('keycloakCreateUserAPI', keycloakCreateUserAPI);

/**
* keycloakResetPasswordAPI is a task wrapped as command with post-verification
* that a user password is successfully reset in keycloak
* @param {string} accessToken - a valid access token
* @param {string} userId - a keycloak userId
* @param {string} password - new password to set
*
* @example
*   cy.keycloakResetPasswordAPI('abcde', '12345', 'password');
*/
function keycloakResetPasswordAPI(accessToken: string, userId: string, password: string): ChainableT {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: `users/${userId}/reset-password`,
        method: 'put',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        data: {type: 'password', temporary: false, value: password},
    }).then((response: any) => {
        if (response.status === 200 && response.data.length > 0) {
            return cy.wrap(response.data[0].id);
        }
        return null;
    });
}

Cypress.Commands.add('keycloakResetPasswordAPI', keycloakResetPasswordAPI);

/**
* keycloakGetUserAPI is a task wrapped as command with post-verification
* that a user is successfully found in keycloak
* @param {string} accessToken - a valid access token
* @param {string} email - an email to query
* @returns {string} - keycloak userId if found
*
* @example
*   cy.keycloakGetUserAPI('abcde', 'test@mm.com');
*/
function keycloakGetUserAPI(accessToken: string, email: string): ChainableT<string> {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: 'users?email=' + email,
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((response: any) => {
        if (response.status === 200 && response.data.length > 0) {
            return cy.wrap<string>(response.data[0].id);
        }
        return null;
    });
}

Cypress.Commands.add('keycloakGetUserAPI', keycloakGetUserAPI);

/**
* keycloakDeleteUserAPI is a task wrapped as command with post-verification
* that a user is successfully deleted in keycloak
* @param {string} accessToken - a valid access token
* @param {string} userId - keycloak user id to delete
*
* @example
*   cy.keycloakDeleteUserAPI('abcde', '12345');
*/
function keycloakDeleteUserAPI(accessToken: string, userId: string): ChainableT {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: `users/${userId}`,
        method: 'delete',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((response: any) => {
        expect(response.status).to.equal(204);
        expect(response.data).is.empty;
    });
}
Cypress.Commands.add('keycloakDeleteUserAPI', keycloakDeleteUserAPI);

/**
* keycloakUpdateUserAPI is a task wrapped as command with post-verification
* that a user is successfully updated in keycloak
* @param {string} accessToken - a valid access token
* @param {string} userId - keycloak user id to delete
* @param {object} data - keycloak user object
*
* @example
*   cy.keycloakUpdateUserAPI('abcde', '12345', {'enabled': false}});
*/
function keycloakUpdateUserAPI(accessToken: string, userId: string, data: any): ChainableT {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: 'users/' + userId,
        method: 'put',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        data,
    }).then((response: any) => {
        expect(response.status).to.equal(204);
        expect(response.data).is.empty;
    });
}
Cypress.Commands.add('keycloakUpdateUserAPI', keycloakUpdateUserAPI);

/**
* keycloakDeleteSessionAPI is a task wrapped as command with post-verification
* that a users session is successfully deleted in keycloak
* @param {string} accessToken - a valid access token
* @param {string} sessionId- keycloak session id to delete
*
* @example
*   cy.keycloakDeleteSessionAPI('abcde', '12345');
*/
function keycloakDeleteSessionAPI(accessToken: string, sessionId: string): ChainableT {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: `sessions/${sessionId}`,
        method: 'delete',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((delResponse: any) => {
        expect(delResponse.status).to.equal(204);
        expect(delResponse.data).is.empty;
    });
}

Cypress.Commands.add('keycloakDeleteSessionAPI', keycloakDeleteSessionAPI);

/**
* keycloakGetUserSessionsAPI is a task wrapped as command with post-verification
* that a users sessions are successfully found
* @param {string} accessToken - a valid access token
* @param {string} userId - keycloak user id to find sessions
* @returns {string[]} - array of keycloak session ids
*
* @example
*   cy.keycloakGetUserSessionsAPI('abcde', '12345');
*/
function keycloakGetUserSessionsAPI(accessToken: string, userId: string): ChainableT<string[]> {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: `users/${userId}/sessions`,
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((response: any) => {
        expect(response.status).to.equal(200);
        expect(response.data);
        return cy.wrap<string[]>(response.data);
    });
}

Cypress.Commands.add('keycloakGetUserSessionsAPI', keycloakGetUserSessionsAPI);

/**
* keycloakDeleteUserSessions is a command that finds a user's sessions
* and deletes them.
* @param {string} accessToken - a valid access token
* @param {string} userId- keycloak user id to delete sessions
*
* @example
*   cy.keycloakDeleteUserSessions('abcde', '12345');
*/
function keycloakDeleteUserSessions(accessToken: string, userId: string): ChainableT {
    return cy.keycloakGetUserSessionsAPI(accessToken, userId).then((responseData) => {
        if (responseData.length > 0) {
            responseData.forEach((sessionId) => {
                cy.keycloakDeleteSessionAPI(accessToken, sessionId);
            });

            // Ensure we clear out these specific cookies
            ['JSESSIONID'].forEach((cookie) => {
                cy.clearCookie(cookie);
            });
        }
    });
}

Cypress.Commands.add('keycloakDeleteUserSessions', keycloakDeleteUserSessions);

/**
* keycloakResetUsers is a command that "resets" (deletes and re-creates) the users.
* @param {object[]} users - an array of user objects
*
* @example
*   cy.keycloakResetUsers([{firstName: 'test', lastName: 'test', email: 'test', username: 'test', enabled: true}]);
*/
function keycloakResetUsers(users: any[]): ChainableT {
    return cy.keycloakGetAccessTokenAPI().then((accessToken) => {
        users.forEach((_user) => {
            cy.keycloakGetUserAPI(accessToken, _user.email).then((userId) => {
                if (userId) {
                    cy.keycloakDeleteUserAPI(accessToken, userId);
                }
            }).then(() => {
                cy.keycloakCreateUser(accessToken, _user).then((_id) => {
                    _user.keycloakId = _id;
                });
            });
        });
    });
}

Cypress.Commands.add('keycloakResetUsers', keycloakResetUsers);

/**
* keycloakCreateUser is a command that creates a keycloak user.
* @param {User} user - a user object
*
* @example
*   cy.keycloakCreateUser({firstName: 'test', lastName: 'test', email: 'test', username: 'test', enabled: true});
*/
function keycloakCreateUser(accessToken: string, user: any): ChainableT {
    return cy.keycloakCreateUserAPI(accessToken, user).then(() => {
        cy.keycloakGetUserAPI(accessToken, user.email).then((newId) => {
            cy.keycloakResetPasswordAPI(accessToken, newId, user.password).then(() => {
                cy.keycloakDeleteUserSessions(accessToken, newId).then(() => {
                    return cy.wrap(newId);
                });
            });
        });
    });
}
Cypress.Commands.add('keycloakCreateUser', keycloakCreateUser);

/**
* keycloakCreateUsers is a command that creates keycloak users.
* @param {User[]} users - an array of users
*
* @example
*   cy.keycloakCreateUsers(users);
*/
function keycloakCreateUsers(users = []) {
    return cy.keycloakGetAccessTokenAPI().then((accessToken) => {
        return users.forEach((user) => {
            return cy.keycloakCreateUser(accessToken, user);
        });
    });
}

Cypress.Commands.add('keycloakCreateUsers', keycloakCreateUsers);

/**
* keycloakUpdateUser is a command that updates a keycloak user data.
* @param {string} userEmail - the user email
* @param {any} data - the user data to update
*
* @example
*   cy.keycloakUpdateUser('user@example.com', {firstName: 'test', lastName: 'test'});
*/
function keycloakUpdateUser(userEmail: string, data: any) {
    return cy.keycloakGetAccessTokenAPI().then((accessToken) => {
        return cy.keycloakGetUserAPI(accessToken, userEmail).then((userId) => {
            return cy.keycloakUpdateUserAPI(accessToken, userId, data);
        });
    });
}

Cypress.Commands.add('keycloakUpdateUser', keycloakUpdateUser);

/**
* keycloakSuspendUser is a command that suspends a user (enabled=false)
* @param {string} userEmail - email of keycloak user
*
* @example
*   cy.keycloakSuspendUser('user@test.com');
*/
function keycloakSuspendUser(userEmail: string) {
    const data = {enabled: false};
    cy.keycloakUpdateUser(userEmail, data);
}

Cypress.Commands.add('keycloakSuspendUser', keycloakSuspendUser);

/**
* keycloakUnsuspendUser is a command that re-activates a user (enabled=true)
* @param {string} userEmail - email of keycloak user
*
* @example
*   cy.keycloakUnsuspendUser('user@test.com');
*/
function keycloakUnsuspendUser(userEmail: string): ChainableT {
    const data = {enabled: true};
    return cy.keycloakUpdateUser(userEmail, data);
}

Cypress.Commands.add('keycloakUnsuspendUser', keycloakUnsuspendUser);

/**
* checkKeycloakLoginPage is a command that verifies the keycloak login page is displayed
*
* @example
*   cy.checkKeycloakLoginPage();
*/
function checkKeycloakLoginPage() {
    cy.findByText('Username or email', {timeout: TIMEOUTS.ONE_SEC}).should('be.visible');
    cy.findByText('Password').should('be.visible');
    cy.findAllByText('Log In').should('be.visible');
}

Cypress.Commands.add('checkKeycloakLoginPage', checkKeycloakLoginPage);

/**
* doKeycloakLogin is a command that attempts to log a user into keycloak.
*
* @example
*   cy.doKeycloakLogin();
*/
function doKeycloakLogin(user: LdapUser) {
    cy.apiLogout();
    cy.visit('/login');
    cy.findByText('SAML').click();
    cy.findByText('Username or email').type(user.email);
    cy.findByText('Password').type(user.password);
    cy.findAllByText('Log In').last().click();
}

Cypress.Commands.add('doKeycloakLogin', doKeycloakLogin);

/**
* verifyKeycloakLoginFailed is a command that verifies a keycloak login failed.
*
* @example
*   cy.verifyKeycloakLoginFailed();
*/
function verifyKeycloakLoginFailed() {
    cy.findAllByText('Account is disabled, contact your administrator.').should('be.visible');
}

Cypress.Commands.add('verifyKeycloakLoginFailed', verifyKeycloakLoginFailed);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            keycloakCreateUsers: typeof keycloakCreateUsers;
            keycloakUpdateUser: typeof keycloakUpdateUser;
            keycloakGetAccessTokenAPI: typeof keycloakGetAccessTokenAPI;
            keycloakCreateUserAPI: typeof keycloakCreateUserAPI;
            keycloakResetPasswordAPI: typeof keycloakResetPasswordAPI;
            keycloakGetUserAPI: typeof keycloakGetUserAPI;
            keycloakDeleteUserAPI: typeof keycloakDeleteUserAPI;
            keycloakUpdateUserAPI: typeof keycloakUpdateUserAPI;
            keycloakDeleteSessionAPI: typeof keycloakDeleteSessionAPI;
            keycloakGetUserSessionsAPI: typeof keycloakGetUserSessionsAPI;
            keycloakDeleteUserSessions: typeof keycloakDeleteUserSessions;
            keycloakResetUsers: typeof keycloakResetUsers;
            keycloakCreateUser: typeof keycloakCreateUser;
            keycloakSuspendUser(userEmail: string): ChainableT<void>;
            keycloakUnsuspendUser: typeof keycloakUnsuspendUser;
            checkKeycloakLoginPage: typeof checkKeycloakLoginPage;
            doKeycloakLogin(user: LdapUser): ChainableT<void>;
            verifyKeycloakLoginFailed: typeof verifyKeycloakLoginFailed;
        }
    }
}
