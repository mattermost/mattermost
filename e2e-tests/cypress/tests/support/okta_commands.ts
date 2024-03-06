// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from 'tests/types';
import * as TIMEOUTS from '../fixtures/timeouts';

const token = 'SSWS ' + Cypress.env('oktaMMAppToken');

type UserId = string | null;

interface Profile {
    firstName: string;
    lastName: string;
    email: string;
    login: string;
    userType: string;
    isAdmin: string;
    isGuest: string;
}

interface User {
    firstname: string;
    lastname: string;
    email: string;
    login: string;
    userType: string;
    isAdmin: string;
    isGuest: string;
    password: string;
}

interface UserCollection {
    admins: User[];
    guests: User[];
    regulars: User[];
}

interface OktaResponse<T = any> {
    status: number;
    data: T;
}

/**
 * Builds a user profile object
 * @param {Object} user - the user data
 * @returns {Object} profile: the user profile
 */
function buildProfile(user: User): Profile {
    const profile: Profile = {
        firstName: user.firstname,
        lastName: user.lastname,
        email: user.email,
        login: user.email,
        userType: user.userType,
        isAdmin: user.isAdmin,
        isGuest: user.isGuest,
    };
    return profile;
}

/**
 * creates a user
 * @param {Object} user - the user to create
 * @returns {String} userId: the user id
 */
function oktaCreateUser(user: any = {}): ChainableT<UserId> {
    const profile = buildProfile(user);
    return cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users/',
        method: 'post',
        token,
        data: {
            profile,
            credentials: {
                password: {value: user.password},
                recovery_question: {
                    question: 'What is the best open source messaging platform for developers?',
                    answer: 'Mattermost',
                },
            },
        },
    }).then((response: OktaResponse<{id: UserId}>) => {
        expect(response.status).to.equal(200);
        const userId = response.data.id;
        return cy.wrap(userId);
    });
}

Cypress.Commands.add('oktaCreateUser', oktaCreateUser);

/**
 * gets a user by user id
 * @param {String} userId - the user id
 * @returns {String} userId: the user id or null if not found
 */
function oktaGetUser(userId: string = ''): ChainableT<UserId> {
    return cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users?q=' + userId,
        method: 'get',
        token,
    }).then((response: OktaResponse<Array<{id: UserId}>>) => {
        expect(response.status).to.be.equal(200);
        if (response.data.length > 0) {
            return cy.wrap(response.data[0].id);
        }
        return cy.wrap(null as UserId);
    });
}

Cypress.Commands.add('oktaGetUser', oktaGetUser);

/**
 * Updates the user data
 * @param {String} userId - the user id
 * @param {Object} user - the user data
 * @returns {Object} data: the user data as a response
 */
function oktaUpdateUser(userId: string = '', user: any = {}): ChainableT<any> {
    const profile = buildProfile(user);

    return cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users/' + userId,
        method: 'post',
        token,
        data: {
            profile,
        },
    }).then((response: OktaResponse) => {
        expect(response.status).to.equal(201);
        return cy.wrap(response.data);
    });
}

Cypress.Commands.add('oktaUpdateUser', oktaUpdateUser);

/**
 * deletes a user by user id
 * @param {String} userId - the user id
 */
function oktaDeleteUser(userId: string = '') {
    cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users/' + userId,
        method: 'delete',
        token,
    }).then((response: OktaResponse) => {
        expect(response.status).to.equal(204);
        expect(response.data).is.empty;
        cy.task('oktaRequest', {
            baseUrl: Cypress.env('oktaApiUrl'),
            urlSuffix: '/users/' + userId,
            method: 'delete',
            token,
        }).then((_response: OktaResponse) => {
            expect(_response.status).to.equal(204);
            expect(_response.data).is.empty;
        });
    });
}

//first we deactivate the user, then we actually delete it
Cypress.Commands.add('oktaDeleteUser', oktaDeleteUser);

/**
 * deletes a user's session
 * @param {String} userId - the user id
 */
function oktaDeleteSession(userId: string = '') {
    cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users/' + userId + '/sessions',
        method: 'delete',
        token,
    }).then((response: OktaResponse) => {
        expect(response.status).to.equal(204);
        expect(response.data).is.empty;

        // Ensure we clear out these specific cookies
        ['JSESSIONID'].forEach((cookie) => {
            cy.clearCookie(cookie);
        });
    });
}

Cypress.Commands.add('oktaDeleteSession', oktaDeleteSession);

/**
 * Assigns a user to an application
 * @param {String} userId - the user id
 * @param {Object} user - the user data
 * @returns {Object} data: the user data as response
 */
function oktaAssignUserToApplication(userId: string = '', user: any = {}): ChainableT<any> {
    return cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/apps/' + Cypress.env('oktaMMAppId') + '/users',
        method: 'post',
        token,
        data: {
            id: userId,
            scope: 'USER',
            profile: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            },
        },
    }).then((response: OktaResponse) => {
        expect(response.status).to.be.equal(200);
        return cy.wrap(response.data);
    });
}

Cypress.Commands.add('oktaAssignUserToApplication', oktaAssignUserToApplication);

/**
 * Gets the user data if exists or create one if does not exists
 * @param {Object} user - the user data
 * @returns {String} userId: the user id
 */
function oktaGetOrCreateUser(user: User): ChainableT<UserId> {
    let userId;
    return cy.oktaGetUser(user.email).then((uId) => {
        userId = uId;
        if (userId == null) {
            cy.oktaCreateUser(user).then((_uId) => {
                userId = _uId;
                cy.oktaAssignUserToApplication(userId, user);
            });
        } else {
            cy.oktaAssignUserToApplication(userId, user);
        }
        return cy.wrap(userId as UserId);
    });
}

Cypress.Commands.add('oktaGetOrCreateUser', oktaGetOrCreateUser);

/**
 * Add users given a collection of users
 * @param {Object} users - a collection of users
 */
function oktaAddUsers(users: UserCollection) {
    let userId;
    Object.values(users.regulars).forEach((_user: User) => {
        cy.oktaGetUser(_user.email).then((uId) => {
            userId = uId;
            if (userId == null) {
                cy.oktaCreateUser(_user).then((_uId) => {
                    userId = _uId;
                    cy.oktaAssignUserToApplication(userId, _user);
                    cy.oktaDeleteSession(userId);
                });
            }
        });
    });

    Object.values(users.guests).forEach((_user: User) => {
        cy.oktaGetUser(_user.email).then((uId) => {
            userId = uId;
            if (userId == null) {
                cy.oktaCreateUser(_user).then((_uId) => {
                    userId = _uId;
                    cy.oktaAssignUserToApplication(userId, _user);
                    cy.oktaDeleteSession(userId);
                });
            }
        });
    });

    Object.values(users.admins).forEach((_user: User) => {
        cy.oktaGetUser(_user.email).then((uId) => {
            userId = uId;
            if (userId == null) {
                cy.oktaCreateUser(_user).then((_uId) => {
                    userId = _uId;
                    cy.oktaAssignUserToApplication(userId, _user);
                    cy.oktaDeleteSession(userId);
                });
            }
        });
    });
}

Cypress.Commands.add('oktaAddUsers', oktaAddUsers);

/**
 * Remove users given a collection of users
 * @param {Object} users - a collection of users
 */
function oktaRemoveUsers(users: UserCollection) {
    let userId;
    Object.values(users.regulars).forEach((_user: User) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId);
            }
        });
    });

    Object.values(users.guests).forEach((_user: User) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId);
            }
        });
    });

    Object.values(users.admins).forEach((_user: User) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId);
            }
        });
    });
}

Cypress.Commands.add('oktaRemoveUsers', oktaRemoveUsers);

/**
 * check if okta login page is visible
 */
function checkOktaLoginPage() {
    cy.findByText('Powered by').should('be.visible');
    cy.findAllByText('Sign In').should('be.visible');
    cy.get('#okta-signin-password').should('be.visible');
    cy.get('#okta-signin-submit').should('be.visible');
}

Cypress.Commands.add('checkOktaLoginPage', checkOktaLoginPage);

/**
 * performs an okta login
 */
function doOktaLogin(user: User) {
    cy.checkOktaLoginPage();

    cy.get('#okta-signin-username').type(user.email);
    cy.get('#okta-signin-password').type(user.password);
    cy.findAllByText('Sign In').last().click().wait(TIMEOUTS.FIVE_SEC);
}

Cypress.Commands.add('doOktaLogin', doOktaLogin);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            oktaCreateUser: typeof oktaCreateUser;
            oktaGetUser: typeof oktaGetUser;
            oktaUpdateUser: typeof oktaUpdateUser;
            oktaDeleteUser: typeof oktaDeleteUser;
            oktaDeleteSession: typeof oktaDeleteSession;
            oktaAssignUserToApplication: typeof oktaAssignUserToApplication;
            oktaGetOrCreateUser: typeof oktaGetOrCreateUser;
            oktaAddUsers: typeof oktaAddUsers;
            oktaRemoveUsers: typeof oktaRemoveUsers;
            checkOktaLoginPage: typeof checkOktaLoginPage;
            doOktaLogin: typeof doOktaLogin;
        }
    }
}
