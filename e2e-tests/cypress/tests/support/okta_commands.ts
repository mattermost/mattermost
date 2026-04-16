// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

import {ChainableT} from '@/types';


const token = 'SSWS ' + Cypress.expose('oktaMMAppToken');

type UserId = string | undefined;

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

export interface UserCollection {
    admins: Record<string, Partial<User>>;
    guests: Record<string, Partial<User>>;
    regulars: Record<string, Partial<User>>;
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
function oktaCreateUser(user: Partial<User> = {}): ChainableT<UserId> {
    const profile = buildProfile(user as User);
    return cy.task('oktaRequest', {
        baseUrl: Cypress.expose('oktaApiUrl'),
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
    // cy.task() returns untyped data
    }).then((response: any) => {
        expect(response.status).to.equal(200);
        const userId = response.data.id;
        return cy.wrap(userId as UserId);
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
        baseUrl: Cypress.expose('oktaApiUrl'),
        urlSuffix: '/users?q=' + userId,
        method: 'get',
        token,
    // cy.task() returns untyped data
    }).then((response: any) => {
        expect(response.status).to.be.equal(200);
        if (response.data.length > 0) {
            return cy.wrap(response.data[0].id as UserId);
        }
        return cy.wrap(undefined as UserId);
    });
}

Cypress.Commands.add('oktaGetUser', oktaGetUser);

/**
 * Updates the user data
 * @param {String} userId - the user id
 * @param {Object} user - the user data
 * @returns {Object} data: the user data as a response
 */
function oktaUpdateUser(userId: string = '', user: Partial<User> = {}) {
    const profile = buildProfile(user as User);

    return cy.task('oktaRequest', {
        baseUrl: Cypress.expose('oktaApiUrl'),
        urlSuffix: '/users/' + userId,
        method: 'post',
        token,
        data: {
            profile,
        },
    // cy.task() returns untyped data
    }).then((response: any) => {
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
    // cy.task() returns untyped data
    cy.task('oktaRequest', {
        baseUrl: Cypress.expose('oktaApiUrl'),
        urlSuffix: '/users/' + userId,
        method: 'delete',
        token,
    }).then((response: any) => {
        expect(response.status).to.equal(204);
        cy.task('oktaRequest', {
            baseUrl: Cypress.expose('oktaApiUrl'),
            urlSuffix: '/users/' + userId,
            method: 'delete',
            token,
        }).then((_response: any) => {
            expect(_response.status).to.equal(204);
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
    // cy.task() returns untyped data
    cy.task('oktaRequest', {
        baseUrl: Cypress.expose('oktaApiUrl'),
        urlSuffix: '/users/' + userId + '/sessions',
        method: 'delete',
        token,
    }).then((response: any) => {
        expect(response.status).to.equal(204);

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
function oktaAssignUserToApplication(userId: string = '', user: Partial<User> = {}) {
    return cy.task('oktaRequest', {
        baseUrl: Cypress.expose('oktaApiUrl'),
        urlSuffix: '/apps/' + Cypress.expose('oktaMMAppId') + '/users',
        method: 'post',
        token,
        data: {
            id: userId,
            scope: 'USER',
            profile: {
                firstName: user.firstname,
                lastName: user.lastname,
                email: user.email,
            },
        },
    // cy.task() returns untyped data
    }).then((response: any) => {
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
    let userId: UserId;
    return cy.oktaGetUser(user.email).then((uId) => {
        userId = uId;
        if (userId == null) {
            cy.oktaCreateUser(user).then((_uId) => {
                userId = _uId;
                cy.oktaAssignUserToApplication(userId as string, user);
            });
        } else {
            cy.oktaAssignUserToApplication(userId as string, user);
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
    let userId: UserId;
    Object.values(users.regulars).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((uId) => {
            userId = uId;
            if (userId == null) {
                cy.oktaCreateUser(_user).then((_uId) => {
                    userId = _uId;
                    cy.oktaAssignUserToApplication(userId as string, _user);
                    cy.oktaDeleteSession(userId as string);
                });
            }
        });
    });

    Object.values(users.guests).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((uId) => {
            userId = uId;
            if (userId == null) {
                cy.oktaCreateUser(_user).then((_uId) => {
                    userId = _uId;
                    cy.oktaAssignUserToApplication(userId as string, _user);
                    cy.oktaDeleteSession(userId as string);
                });
            }
        });
    });

    Object.values(users.admins).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((uId) => {
            userId = uId;
            if (userId == null) {
                cy.oktaCreateUser(_user).then((_uId) => {
                    userId = _uId;
                    cy.oktaAssignUserToApplication(userId as string, _user);
                    cy.oktaDeleteSession(userId as string);
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
    let userId: UserId;
    Object.values(users.regulars).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId as string);
            }
        });
    });

    Object.values(users.guests).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId as string);
            }
        });
    });

    Object.values(users.admins).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId as string);
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
            doOktaLogin(user: User): ChainableT<void>;
        }
    }
}
