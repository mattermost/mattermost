// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Login to server via API.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1login/post
         * @param {string} user.username - username of a user
         * @param {string} user.password - password of  user
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiLogin({username: 'sysadmin', password: 'secret'});
         */
        apiLogin(user: UserProfile): Chainable<UserProfile>;

        /**
         * Login to server via API.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1login/post
         * @param {string} user.username - username of a user
         * @param {string} user.password - password of  user
         * @param {string} token - MFA token for the session
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiLoginWithMFA({username: 'sysadmin', password: 'secret', token: '123456'});
         */
        apiLoginWithMFA(user: UserProfile, token: string): Chainable<{user: UserProfile}>;

        /**
         * Login as admin via API.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1login/post
         * @param {Object} requestOptions - cypress' request options object, see https://docs.cypress.io/api/commands/request#Arguments
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiAdminLogin();
         */
        apiAdminLogin(requestOptions?: Record<string, any>): Chainable<UserProfile>;

        /**
         * Login as admin via API.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1login/post
         * @param {string} token - MFA token for the session
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiAdminLoginWithMFA(token);
         */
        apiAdminLoginWithMFA(token: string): Chainable<{user: UserProfile}>;

        /**
         * Logout a user's active session from server via API.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1logout/post
         * Clears all cookies especially `MMAUTHTOKEN`, `MMUSERID` and `MMCSRF`.
         *
         * @example
         *   cy.apiLogout();
         */
        apiLogout();

        /**
         * Get current user.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}/get
         * @returns {user: UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiGetMe().then(({user}) => {
         *       // do something with user
         *   });
         */
        apiGetMe(): Chainable<{user: UserProfile}>;

        /**
         * Get a user by ID.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}/get
         * @param {String} userId - ID of a user to get profile
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiGetUserById('user-id').then(({user}) => {
         *       // do something with user
         *   });
         */
        apiGetUserById(userId: string): Chainable<UserProfile>;

        /**
         * Get a user by email.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1email~1{email}/get
         * @param {String} email - email address of a user to get profile
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiGetUserByEmail('email').then(({user}) => {
         *       // do something with user
         *   });
         */
        apiGetUserByEmail(email: string): Chainable<{user: UserProfile}>;

        /**
         * Get users by usernames.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1usernames/post
         * @param {String[]} usernames - list of usernames to get profiles
         * @returns {UserProfile[]} out.users: list of `UserProfile` objects
         *
         * @example
         *   cy.apiGetUsersByUsernames().then(({users}) => {
         *       // do something with users
         *   });
         */
        apiGetUsersByUsernames(usernames: string[]): Chainable<UserProfile[]>;

        /**
         * Patch a user.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1patch/put
         * @param {String} userId - ID of user to patch
         * @param {UserProfile} userData - user profile to be updated
         * @param {string} userData.email
         * @param {string} userData.username
         * @param {string} userData.first_name
         * @param {string} userData.last_name
         * @param {string} userData.nickname
         * @param {string} userData.locale
         * @param {Object} userData.timezone
         * @param {string} userData.position
         * @param {Object} userData.props
         * @param {Object} userData.notify_props
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiPatchUser('user-id', {locale: 'en'}).then(({user}) => {
         *       // do something with user
         *   });
         */
        apiPatchUser(userId: string, userData: UserProfile): Chainable<{user: UserProfile}>;

        /**
         * Convenient command to patch a current user.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1patch/put
         * @param {UserProfile} userData - user profile to be updated
         * @param {string} userData.email
         * @param {string} userData.username
         * @param {string} userData.first_name
         * @param {string} userData.last_name
         * @param {string} userData.nickname
         * @param {string} userData.locale
         * @param {Object} userData.timezone
         * @param {string} userData.position
         * @param {Object} userData.props
         * @param {Object} userData.notify_props
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiPatchMe({locale: 'en'}).then(({user}) => {
         *       // do something with user
         *   });
         */
        apiPatchMe(userData: UserProfile): Chainable<UserProfile>;

        /**
         * Create an admin account based from the env variables defined in Cypress env.
         * @param {string} options.namePrefix - 'user' (default) or any prefix to easily identify a user
         * @param {boolean} options.bypassTutorial - true (default) or false for user to go thru tutorial steps
         * @param {boolean} options.showOnboarding - false (default) to hide or true to show Onboarding steps
         * @returns {UserProfile} `out.sysadmin` as `UserProfile` object
         *
         * @example
         *   cy.apiCreateAdmin(options);
         */
        apiCreateAdmin(options: Record<string, any>): Chainable<UserProfile>;

        /**
         * Create a randomly named admin account
         *
         * @param {boolean} options.loginAfter - false (default) or true if wants to login as the new admin.
         * @param {boolean} options.hideAdminTrialModal - true (default) or false if wants to hide Start Enterprise Trial modal.
         *
         * @returns {UserProfile} `out.sysadmin` as `UserProfile` object
         */
        apiCreateCustomAdmin(options: {loginAfter: boolean; hideAdminTrialModal?: boolean}): Chainable<{sysadmin: UserProfile}>;

        /**
         * Create a new user with an options to set name prefix and be able to bypass tutorial steps.
         * @param {string} options.user - predefined `user` object instead on random user
         * @param {string} options.prefix - 'user' (default) or any prefix to easily identify a user
         * @param {boolean} options.bypassTutorial - true (default) or false for user to go thru tutorial steps
         * @param {boolean} options.showOnboarding - false (default) to hide or true to show Onboarding steps
         * @returns {UserProfile} `out.user` as `UserProfile` object
         *
         * @example
         *   cy.apiCreateUser(options);
         */
        apiCreateUser(options?: {
            user?: Partial<UserProfile>;
            prefix?: string;
            bypassTutorial?: boolean;
            showOnboarding?: boolean;
        }): Chainable<{user: UserProfile}>;

        /**
         * Create a new guest user with an options to set name prefix and be able to bypass tutorial steps.
         * @param {string} options.prefix - 'guest' (default) or any prefix to easily identify a guest
         * @param {boolean} options.bypassTutorial - true (default) or false for guest to go thru tutorial steps
         * @param {boolean} options.showOnboarding - false (default) to hide or true to show Onboarding steps
         * @returns {UserProfile} `out.guest` as `UserProfile` object
         *
         * @example
         *   cy.apiCreateGuestUser(options);
         */
        apiCreateGuestUser(options: Record<string, any>): Chainable<{guest: UserProfile}>;

        /**
         * Revoke all active sessions for a user.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1sessions~1revoke~1all/post
         * @param {String} userId - ID of a user
         * @returns {Object} `out.data` as response status
         *
         * @example
         *   cy.apiRevokeUserSessions('user-id');
         */
        apiRevokeUserSessions(userId: string): Chainable<Record<string, any>>;

        /**
         * Get list of users based on query parameters
         * See https://api.mattermost.com/#tag/users/paths/~1users/get
         * @param {String} queryParams - see link on available query parameters
         * @returns {UserProfile[]} `out.users` as `UserProfile[]` object
         *
         * @example
         *   cy.apiGetUsers().then(({users}) => {
         *       // do something with users
         *   });
         */
        apiGetUsers(queryParams: Record<string, any>): Chainable<UserProfile[]>;

        /**
         * Get list of users that are not team members.
         * See https://api.mattermost.com/#tag/users/paths/~1users/get
         * @param {String} queryParams.teamId - Team ID
         * @param {String} queryParams.page - Page to select, 0 (default)
         * @param {String} queryParams.perPage - The number of users per page, 60 (default)
         * @returns {UserProfile[]} `out.users` as `UserProfile[]` object
         *
         * @example
         *   cy.apiGetUsersNotInTeam({teamId: 'team-id'}).then(({users}) => {
         *       // do something with users
         *   });
         */
        apiGetUsersNotInTeam(queryParams: Record<string, any>): Chainable<UserProfile[]>;

        /**
         * Reactivate a user account.
         * @param {string} userId - User ID
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiActivateUser('user-id');
         */
        apiActivateUser(userId: string): Chainable<Response>;

        /**
         * Deactivate a user account.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}/delete
         * @param {string} userId - User ID
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiDeactivateUser('user-id');
         */
        apiDeactivateUser(userId: string): Chainable<Response>;

        /**
         * Convert a regular user into a guest. This will convert the user into a guest for the whole system while retaining their existing team and channel memberships.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1demote/post
         * @param {string} userId - User ID
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiDemoteUserToGuest('user-id');
         */
        apiDemoteUserToGuest(userId: string): Chainable<UserProfile>;

        /**
         * Convert a guest into a regular user. This will convert the guest into a user for the whole system while retaining any team and channel memberships and automatically joining them to the default channels.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1promote/post
         * @param {string} userId - User ID
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiPromoteGuestToUser('user-id');
         */
        apiPromoteGuestToUser(userId: string): Chainable<UserProfile>;

        /**
         * Verifies a user's email via userId without having to go to the user's email inbox.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1email~1verify~1member/post
         * @param {string} userId - User ID
         * @returns {UserProfile} out.user: `UserProfile` object
         *
         * @example
         *   cy.apiVerifyUserEmailById('user-id').then(({user}) => {
         *       // do something with user
         *   });
         */
        apiVerifyUserEmailById(userId: string): Chainable<UserProfile>;

        /**
         * Update a user MFA.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1mfa/put
         * @param {String} userId - ID of user to patch
         * @param {boolean} activate - Whether MFA is going to be enabled or disabled
         * @param {string} token - MFA token/code
         * @example
         *   cy.apiActivateUserMFA('user-id', activate: false);
         */
        apiActivateUserMFA(userId: string, activate: boolean, token: string): Chainable<Response>;

        /**
         * Create a user access token
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1tokens/post
         * @param {String} userId - ID of user for whom to generate token
         * @param {String} description - The description of the token usage
         * @example
         *   cy.apiAccessToken('user-id', 'token for cypress tests');
         */
        apiAccessToken(userId: string, description: string): Chainable<UserAccessToken>;

        /**
         * Revoke a user access token
         * See https://api.mattermost.com/#tag/users/paths/~1users~1tokens~1revoke/post
         * @param {String} tokenId - The id of the token to revoke
         * @example
         *   cy.apiRevokeAccessToken('token-id')
         */
        apiRevokeAccessToken(tokenId: string): Chainable<Response>;

        /**
         * Update a user auth method.
         * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1mfa/put
         * @param {String} userId - ID of user to patch
         * @param {String} authData
         * @param {String} password
         * @param {String} authService
         * @example
         *   cy.apiUpdateUserAuth('user-id', 'auth-data', 'password', 'auth-service');
         */
        apiUpdateUserAuth(userId: string, authData: string, password: string, authService: string): Chainable<Response>;

        /**
         * Get total count of users in the system
         * See https://api.mattermost.com/#operation/GetTotalUsersStats
         *
         * @returns {number} - total count of all users
         *
         * @example
         *   cy.apiGetTotalUsers().then(() => {
         *      // do something with total users
         *   });
         */
        apiGetTotalUsers(): Chainable<number>;
    }
}
