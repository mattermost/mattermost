// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserAccessToken, UserProfile} from '@mattermost/types/users';
import authenticator from 'authenticator';
import {ChainableT} from 'tests/types';

import {getRandomId} from '../../utils';
import {getAdminAccount} from '../env';

import {buildQueryString} from './helpers';

// *****************************************************************************
// Users
// https://api.mattermost.com/#tag/users
// *****************************************************************************

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
function apiLogin(user: Partial<Pick<UserProfile, 'username' | 'email' | 'password'>>, requestOptions: Record<string, any> = {}): ChainableT<{user: UserProfile} | {error: any}> {
    return cy.request<UserProfile | any>({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/login',
        method: 'POST',
        body: {login_id: user.username || user.email, password: user.password},
        ...requestOptions,
    }).then((response) => {
        if (requestOptions.failOnStatusCode) {
            expect(response.status).to.equal(200);
        }

        if (response.status === 200) {
            return cy.wrap<{user: UserProfile}>({
                user: {
                    ...response.body,
                    password: user.password,
                },
            });
        }

        return cy.wrap({error: response.body});
    });
}

Cypress.Commands.add('apiLogin', apiLogin);

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
function apiLoginWithMFA(user: {username: string; password: string}, token: string): ChainableT<{user: UserProfile}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/login',
        method: 'POST',
        body: {login_id: user.username, password: user.password, token},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap<{user: UserProfile}>({
            user: {
                ...response.body,
                password: user.password,
            },
        });
    });
}

Cypress.Commands.add('apiLoginWithMFA', apiLoginWithMFA);

/**
 * Login as admin via API.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1login/post
 * @param {Object} requestOptions - cypress' request options object, see https://docs.cypress.io/api/commands/request#Arguments
 * @returns {UserProfile} out.user: `UserProfile` object
 *
 * @example
 *   cy.apiAdminLogin();
 */
function apiAdminLogin(requestOptions?: Record<string, any>): ChainableT<{user: UserProfile}> {
    const admin = getAdminAccount();

    // First, login with username
    return cy.apiLogin(admin, requestOptions).then((resp) => {
        if ((<{error: any}>resp).error) {
            if ((<{error: any}>resp).error.id === 'mfa.validate_token.authenticate.app_error') {
                // On fail, try to login via MFA
                return cy.dbGetUser({username: admin.username}).then(({user: {mfasecret}}) => {
                    const token = authenticator.generateToken(mfasecret);
                    return cy.apiLoginWithMFA(admin, token);
                });
            }

            // Or, try to login via email
            delete admin.username;
            return cy.apiLogin(admin, requestOptions) as ChainableT<{user: UserProfile}>;
        }

        return cy.wrap(resp as {user: UserProfile});
    });
}

Cypress.Commands.add('apiAdminLogin', apiAdminLogin);

/**
 * Login as admin via API.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1login/post
 * @param {string} token - MFA token for the session
 * @returns {UserProfile} out.user: `UserProfile` object
 *
 * @example
 *   cy.apiAdminLoginWithMFA(token);
 */
function apiAdminLoginWithMFA(token): ChainableT<{user: UserProfile}> {
    const admin = getAdminAccount();

    return cy.apiLoginWithMFA(admin, token);
}

Cypress.Commands.add('apiAdminLoginWithMFA', apiAdminLoginWithMFA);

/**
 * Logout a user's active session from server via API.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1logout/post
 * Clears all cookies especially `MMAUTHTOKEN`, `MMUSERID` and `MMCSRF`.
 *
 * @example
 *   cy.apiLogout();
 */
function apiLogout() {
    cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/logout',
        method: 'POST',
        log: false,
    });

    // * Verify logged out
    cy.visit('/login?extra=expired').url().should('include', '/login');

    // # Ensure we clear out these specific cookies
    ['MMAUTHTOKEN', 'MMUSERID', 'MMCSRF'].forEach((cookie) => {
        cy.clearCookie(cookie);
    });

    // # Clear remainder of cookies
    cy.clearCookies();
}

Cypress.Commands.add('apiLogout', apiLogout);

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
function apiGetMe(): ChainableT<{user: UserProfile}> {
    return cy.apiGetUserById('me');
}

Cypress.Commands.add('apiGetMe', apiGetMe);

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
function apiGetUserById(userId: string): ChainableT<{user: UserProfile}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/' + userId,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
}

Cypress.Commands.add('apiGetUserById', apiGetUserById);

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
function apiGetUserByEmail(email: string, failOnStatusCode = true): ChainableT<{user: UserProfile}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/email/' + email,
        failOnStatusCode,
    }).then((response) => {
        const {body, status} = response;

        if (failOnStatusCode) {
            expect(status).to.equal(200);
            return cy.wrap({user: body});
        }
        return cy.wrap({user: status === 200 ? body : null});
    });
}

Cypress.Commands.add('apiGetUserByEmail', apiGetUserByEmail);

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
function apiGetUsersByUsernames(usernames: string[] = []): ChainableT<{users: UserProfile[]}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/usernames',
        method: 'POST',
        body: usernames,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({users: response.body});
    });
}

Cypress.Commands.add('apiGetUsersByUsernames', apiGetUsersByUsernames);

/**
 * Patch a user.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1patch/put
 * @param {String} userId - ID of user to patch
 * @param {UserProfile} userData - user profile to be updated
 * @returns {UserProfile} out.user: `UserProfile` object
 *
 * @example
 *   cy.apiPatchUser('user-id', {locale: 'en'}).then(({user}) => {
 *       // do something with user
 *   });
 */
function apiPatchUser(userId: string, userData: Partial<UserProfile>): ChainableT<{user: UserProfile}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/users/${userId}/patch`,
        body: userData,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
}
Cypress.Commands.add('apiPatchUser', apiPatchUser);

/**
 * Convenient command to patch a current user.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1patch/put
 * @param {UserProfile} userData - user profile to be updated
 * @returns {UserProfile} out.user: `UserProfile` object
 *
 * @example
 *   cy.apiPatchMe({locale: 'en'}).then(({user}) => {
 *       // do something with user
 *   });
 */
function apiPatchMe(data: Partial<UserProfile>): ChainableT<{user: UserProfile}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/me/patch',
        method: 'PUT',
        body: data,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
}

Cypress.Commands.add('apiPatchMe', apiPatchMe);

/**
 * Create a randomly named admin account
 *
 * @param {boolean} options.loginAfter - false (default) or true if wants to login as the new admin.
 * @param {boolean} options.hideAdminTrialModal - true (default) or false if wants to hide Start Enterprise Trial modal.
 *
 * @returns {UserProfile} `out.sysadmin` as `UserProfile` object
 */
function apiCreateCustomAdmin({loginAfter = false, hideAdminTrialModal = true} = {}): ChainableT<{sysadmin: UserProfile}> {
    const sysadminUser = generateRandomUser('other-admin');

    return cy.apiCreateUser({user: sysadminUser}).then(({user}) => {
        return cy.apiPatchUserRoles(user.id, ['system_admin', 'system_user']).then(() => {
            const data = {sysadmin: user};

            cy.apiSaveStartTrialModal(user.id, hideAdminTrialModal.toString());

            if (loginAfter) {
                return cy.apiLogin(user).then(() => {
                    return cy.wrap(data);
                });
            }

            return cy.wrap(data);
        });
    });
}

Cypress.Commands.add('apiCreateCustomAdmin', apiCreateCustomAdmin);

/**
 * Create an admin account based from the env variables defined in Cypress env.
 * @returns {UserProfile} `out.sysadmin` as `UserProfile` object
 *
 * @example
 *   cy.apiCreateAdmin();
 */
function apiCreateAdmin() {
    const {username, password} = getAdminAccount();

    const sysadminUser = {
        username,
        password,
        first_name: 'Kenneth',
        last_name: 'Moreno',
        email: 'sysadmin@sample.mattermost.com',
    };

    const options = {
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
        url: '/api/v4/users',
        body: sysadminUser,
    };

    // # Create a new user
    return cy.request(options).then((res) => {
        expect(res.status).to.equal(201);

        return cy.wrap({sysadmin: {...res.body, password}});
    });
}

Cypress.Commands.add('apiCreateAdmin', apiCreateAdmin);

function generateRandomUser(prefix = 'user', createAt = 0): Partial<UserProfile> {
    const randomId = getRandomId();

    return {
        email: `${prefix}${randomId}@sample.mattermost.com`,
        username: `${prefix}${randomId}`,
        password: 'passwd',
        first_name: `First${randomId}`,
        last_name: `Last${randomId}`,
        nickname: `Nickname${randomId}`,
        create_at: createAt,
    };
}

/**
 * Create a new user with an options to set name prefix and be able to bypass tutorial steps.
 * @param {string} options.user - predefined `user` object instead on random user
 * @param {string} options.prefix - 'user' (default) or any prefix to easily identify a user
 * @param {boolean} options.bypassTutorial - true (default) or false for user to go thru tutorial steps
 * @param {boolean} options.hideOnboarding - true (default) to hide or false to show Onboarding steps
 * @returns {UserProfile} `out.user` as `UserProfile` object
 *
 * @example
 *   cy.apiCreateUser(options);
 */
interface CreateUserOptions {
    user: Partial<UserProfile>;
    prefix?: string;
    createAt?: number;
    bypassTutorial?: boolean;
    hideOnboarding: boolean;
    bypassWhatsNewModal: boolean;
}

function apiCreateUser({
    prefix = 'user',
    createAt = 0,
    bypassTutorial = true,
    hideOnboarding = true,
    bypassWhatsNewModal = true,
    user = null,
}: Partial<CreateUserOptions> = {}): ChainableT<{user: UserProfile}> {
    const newUser = user || generateRandomUser(prefix, createAt);

    const createUserOption = {
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
        url: '/api/v4/users',
        body: newUser,
    };

    return cy.request(createUserOption).then((userRes) => {
        expect(userRes.status).to.equal(201);

        const createdUser = userRes.body;

        // hide the onboarding task list by default so it doesn't block the execution of subsequent tests
        cy.apiSaveSkipStepsPreference(createdUser.id, 'true');
        cy.apiSaveOnboardingTaskListPreference(createdUser.id, 'onboarding_task_list_open', 'false');
        cy.apiSaveOnboardingTaskListPreference(createdUser.id, 'onboarding_task_list_show', 'false');

        // hide drafts tour tip so it doesn't block the execution of subsequent tests
        cy.apiSaveDraftsTourTipPreference(createdUser.id, true);

        if (bypassTutorial) {
            cy.apiDisableTutorials(createdUser.id);
        }

        if (hideOnboarding) {
            cy.apiSaveOnboardingPreference(createdUser.id, 'hide', 'true');
            cy.apiSaveOnboardingPreference(createdUser.id, 'skip', 'true');
        }

        if (bypassWhatsNewModal) {
            cy.apiHideSidebarWhatsNewModalPreference(createdUser.id, 'false');
        }

        return cy.wrap({user: {...createdUser, password: newUser.password}});
    });
}

Cypress.Commands.add('apiCreateUser', apiCreateUser);

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
function apiCreateGuestUser({
    prefix = 'guest',
    bypassTutorial = true,
}: Partial<CreateUserOptions>): ChainableT<{guest: UserProfile}> {
    return cy.apiCreateUser({prefix, bypassTutorial}).then(({user}) => {
        cy.apiDemoteUserToGuest(user.id);

        return cy.wrap({guest: user});
    });
}

Cypress.Commands.add('apiCreateGuestUser', apiCreateGuestUser);

/**
 * Revoke all active sessions for a user
 * @param {String} userId - ID of user to revoke sessions
 */

/**
 * Revoke all active sessions for a user.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1sessions~1revoke~1all/post
 * @param {String} userId - ID of a user
 * @returns {Object} `out.data` as response status
 *
 * @example
 *   cy.apiRevokeUserSessions('user-id');
 */
function apiRevokeUserSessions(userId: string): ChainableT<Record<string, any>> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/sessions/revoke/all`,
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({data: response.body});
    });
}

Cypress.Commands.add('apiRevokeUserSessions', apiRevokeUserSessions);

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
function apiGetUsers(queryParams: Record<string, any>): ChainableT<{users: UserProfile[]}> {
    const queryString = buildQueryString(queryParams);

    return cy.request({
        method: 'GET',
        url: `/api/v4/users?${queryString}`,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({users: response.body as UserProfile[]});
    });
}

Cypress.Commands.add('apiGetUsers', apiGetUsers);

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
function apiGetUsersNotInTeam({teamId, page = 0, perPage = 60}: Record<string, any>): ChainableT<{users: UserProfile[]}> {
    return cy.apiGetUsers({not_in_team: teamId, page, per_page: perPage});
}

Cypress.Commands.add('apiGetUsersNotInTeam', apiGetUsersNotInTeam);

/**
 * patch user roles
 * @param {String} userId - ID of user to patch
 * @param {String[]} roleNames - The user roles
 * @returns {any} - the result of patching the user roles
 * @example
 *   cy.apiPatchUserRoles('user-id', ['system_user']);
 */
function apiPatchUserRoles(userId: string, roleNames: string[] = ['system_user']): any {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/roles`,
        method: 'PUT',
        body: {roles: roleNames.join(' ')},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
}

Cypress.Commands.add('apiPatchUserRoles', apiPatchUserRoles);

/**
 * Deactivate a user account.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}/delete
 * @param {string} userId - User ID
 * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
 *
 * @example
 *   cy.apiDeactivateUser('user-id');
 */
function apiDeactivateUser(userId: string): ChainableT<any> {
    const options = {
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'DELETE',
        url: `/api/v4/users/${userId}`,
    };

    // # Deactivate a user account
    return cy.request(options).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiDeactivateUser', apiDeactivateUser);

/**
 * Reactivate a user account.
 * @param {string} userId - User ID
 * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
 *
 * @example
 *   cy.apiActivateUser('user-id');
 */
function apiActivateUser(userId: string): ChainableT<any> {
    const options = {
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/users/${userId}/active`,
        body: {
            active: true,
        },
    };

    // # Activate a user account
    return cy.request(options).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiActivateUser', apiActivateUser);

/**
 * Convert a regular user into a guest. This will convert the user into a guest for the whole system while retaining their existing team and channel memberships.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1demote/post
 * @param {string} userId - User ID
 * @returns {UserProfile} out.guest: `UserProfile` object
 *
 * @example
 *   cy.apiDemoteUserToGuest('user-id');
 */
function apiDemoteUserToGuest(userId: string): ChainableT<{guest: UserProfile}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/demote`,
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.apiGetUserById(userId).then(({user}) => {
            return cy.wrap({guest: user});
        });
    });
}

Cypress.Commands.add('apiDemoteUserToGuest', apiDemoteUserToGuest);

/**
 * Convert a guest into a regular user. This will convert the guest into a user for the whole system while retaining any team and channel memberships and automatically joining them to the default channels.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1promote/post
 * @param {string} userId - User ID
 * @returns {UserProfile} out.user: `UserProfile` object
 *
 * @example
 *   cy.apiPromoteGuestToUser('user-id');
 */
function apiPromoteGuestToUser(userId: string): ChainableT<{user: UserProfile}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/promote`,
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.apiGetUserById(userId);
    });
}

Cypress.Commands.add('apiPromoteGuestToUser', apiPromoteGuestToUser);

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
function apiVerifyUserEmailById(userId: string): ChainableT<{user: UserProfile}> {
    const options = {
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
        url: `/api/v4/users/${userId}/email/verify/member`,
    };

    return cy.request(options).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
}

Cypress.Commands.add('apiVerifyUserEmailById', apiVerifyUserEmailById);

/**
 * Update a user MFA.
 * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1mfa/put
 * @param {String} userId - ID of user to patch
 * @param {boolean} activate - Whether MFA is going to be enabled or disabled
 * @param {string} token - MFA token/code
 * @example
 *   cy.apiActivateUserMFA('user-id', activate: false);
 */
function apiActivateUserMFA(userId: string, activate: boolean, token: string): ChainableT<any> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/mfa`,
        method: 'PUT',
        body: {
            activate,
            code: token,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiActivateUserMFA', apiActivateUserMFA);

function apiResetPassword(userId, currentPass, newPass) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/users/${userId}/password`,
        body: {
            current_password: currentPass,
            new_password: newPass,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
}

Cypress.Commands.add('apiResetPassword', apiResetPassword);

function apiGenerateMfaSecret(userId) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
        url: `/api/v4/users/${userId}/mfa/generate`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({code: response.body});
    });
}

Cypress.Commands.add('apiGenerateMfaSecret', apiGenerateMfaSecret);

/**
 * Create a user access token
 * See https://api.mattermost.com/#tag/users/paths/~1users~1{user_id}~1tokens/post
 * @param {String} userId - ID of user for whom to generate token
 * @param {String} description - The description of the token usage
 * @example
 *   cy.apiAccessToken('user-id', 'token for cypress tests');
 */
function apiAccessToken(userId: string, description: string): ChainableT<UserAccessToken> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/' + userId + '/tokens',
        method: 'POST',
        body: {
            description,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body as UserAccessToken);
    });
}

Cypress.Commands.add('apiAccessToken', apiAccessToken);

/**
 * Revoke a user access token
 * See https://api.mattermost.com/#tag/users/paths/~1users~1tokens~1revoke/post
 * @param {String} tokenId - The id of the token to revoke
 * @example
 *   cy.apiRevokeAccessToken('token-id')
 */
function apiRevokeAccessToken(tokenId: string): ChainableT<any> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/tokens/revoke',
        method: 'POST',
        body: {
            token_id: tokenId,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiRevokeAccessToken', apiRevokeAccessToken);

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
function apiUpdateUserAuth(userId: string, authData: string, password: string, authService: string): ChainableT<any> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/users/${userId}/auth`,
        body: {
            auth_data: authData,
            password,
            auth_service: authService,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiUpdateUserAuth', apiUpdateUserAuth);

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
function apiGetTotalUsers(): ChainableT<number> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'GET',
        url: '/api/v4/users/stats',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body.total_users_count as number);
    });
}

Cypress.Commands.add('apiGetTotalUsers', apiGetTotalUsers);

export {generateRandomUser};

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            apiLogin: typeof apiLogin;
            apiLoginWithMFA: typeof apiLoginWithMFA;
            apiAdminLogin: typeof apiAdminLogin;
            apiAdminLoginWithMFA: typeof apiAdminLoginWithMFA;
            apiLogout(): ChainableT<void>;
            apiGetMe: typeof apiGetMe;
            apiGetUserById: typeof apiGetUserById;
            apiGetUserByEmail: typeof apiGetUserByEmail;
            apiGetUsersByUsernames: typeof apiGetUsersByUsernames;
            apiPatchUser: typeof apiPatchUser;
            apiPatchMe: typeof apiPatchMe;
            apiCreateCustomAdmin: typeof apiCreateCustomAdmin;
            apiCreateAdmin: typeof apiCreateAdmin;
            apiCreateUser: typeof apiCreateUser;
            apiCreateGuestUser: typeof apiCreateGuestUser;
            apiRevokeUserSessions: typeof apiRevokeUserSessions;
            apiGetUsers: typeof apiGetUsers;
            apiGetUsersNotInTeam: typeof apiGetUsersNotInTeam;
            apiPatchUserRoles: typeof apiPatchUserRoles;
            apiDeactivateUser: typeof apiDeactivateUser;
            apiActivateUser: typeof apiActivateUser;
            apiDemoteUserToGuest: typeof apiDemoteUserToGuest;
            apiPromoteGuestToUser: typeof apiPromoteGuestToUser;
            apiVerifyUserEmailById: typeof apiVerifyUserEmailById;
            apiActivateUserMFA: typeof apiActivateUserMFA;
            apiResetPassword: typeof apiResetPassword;
            apiGenerateMfaSecret: typeof apiGenerateMfaSecret;
            apiAccessToken: typeof apiAccessToken;
            apiRevokeAccessToken: typeof apiRevokeAccessToken;
            apiUpdateUserAuth: typeof apiUpdateUserAuth;
            apiGetTotalUsers: typeof apiGetTotalUsers;
        }
    }
}
