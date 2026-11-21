// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `keycloak` prefix, e.g. `keycloakActivateUser`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
        * keycloakGetAccessTokenAPI is a task wrapped as command with post-verification
        * that an Access Token is successfully retrieved
        * @returns {string} - access token
        */
        keycloakGetAccessTokenAPI(): Chainable<string>;

        /**
        * keycloakCreateUserAPI is a task wrapped as command with post-verification
        * that a user is successfully created in keycloak
        * @param {string} accessToken - a valid access token
        * @param {object} user - a keycloak user object to create
        *
        * @example
        *   cy.keycloakCreateUserAPI('abcde', {firstName: 'test', lastName: 'test', email: 'test', username: 'test', enabled: true,});
        */
        keycloakCreateUserAPI(accessToken: string, user: any): Chainable;

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
        keycloakResetPasswordAPI(accessToken: string, userId: string, password: string): Chainable;

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
        keycloakGetUserAPI(accessToken: string, email: string): Chainable<string>;

        /**
        * keycloakDeleteUserAPI is a task wrapped as command with post-verification
        * that a user is successfully deleted in keycloak
        * @param {string} accessToken - a valid access token
        * @param {string} userId - keycloak user id to delete
        *
        * @example
        *   cy.keycloakDeleteUserAPI('abcde', '12345');
        */
        keycloakDeleteUserAPI(accessToken: string, userId: string): Chainable;

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
        keycloakUpdateUserAPI(accessToken: string, userId: string, data: any): Chainable;

        /**
        * keycloakDeleteSessionAPI is a task wrapped as command with post-verification
        * that a users session is successfully deleted in keycloak
        * @param {string} accessToken - a valid access token
        * @param {string} sessionId- keycloak session id to delete
        *
        * @example
        *   cy.keycloakDeleteSessionAPI('abcde', '12345');
        */
        keycloakDeleteSessionAPI(accessToken: string, sessionId: string): Chainable;

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
        keycloakGetUserSessionsAPI(accessToken: string, userId: string): Chainable<string[]> ;

        /**
        * keycloakDeleteUserSessions is a command that finds a user's sessions
        * and deletes them.
        * @param {string} accessToken - a valid access token
        * @param {string} userId- keycloak user id to delete sessions
        *
        * @example
        *   cy.keycloakDeleteUserSessions('abcde', '12345');
        */
        keycloakDeleteUserSessions(accessToken: string, userId: string): Chainable;

        /**
        * keycloakResetUsers is a command that "resets" (deletes and re-creates) the users.
        * @param {object[]} users - an array of user objects
        *
        * @example
        *   cy.keycloakResetUsers([{firstName: 'test', lastName: 'test', email: 'test', username: 'test', enabled: true}]);
        */
        keycloakResetUsers(users: any[]): Chainable;

        /**
        * keycloakCreateUser is a command that creates a keycloak user.
        * @param {User} user - a user object
        *
        * @example
        *   cy.keycloakCreateUser({firstName: 'test', lastName: 'test', email: 'test', username: 'test', enabled: true});
        */
        keycloakCreateUser(user: any): Chainable;

        /**
        * keycloakSuspendUser is a command that suspends a user (enabled=false)
        * @param {string} userEmail - email of keycloak user
        *
        * @example
        *   cy.keycloakSuspendUser('user@test.com');
        */
        keycloakSuspendUser(userEmail: string): Chainable;

        /**
        * keycloakUnsuspendUser is a command that re-activates a user (enabled=true)
        * @param {string} userEmail - email of keycloak user
        *
        * @example
        *   cy.keycloakUnsuspendUser('user@test.com');
        */
        keycloakUnsuspendUser(userEmail: string): Chainable;

        /**
        * checkKeycloakLoginPage is a command that verifies the keycloak login page is displayed
        *
        * @example
        *   cy.checkKeycloakLoginPage();
        */
        checkKeycloakLoginPage(): Chainable;

        /**
        * doKeycloakLogin is a command that attempts to log a user into keycloak.
        *
        * @example
        *   cy.doKeycloakLogin();
        */
        doKeycloakLogin(user): Chainable;

        /**
        * verifyKeycloakLoginFailed is a command that verifies a keycloak login failed.
        *
        * @example
        *   cy.verifyKeycloakLoginFailed();
        */
        verifyKeycloakLoginFailed(): Chainable;
    }
}
