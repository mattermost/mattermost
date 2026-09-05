// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

const token = 'SSWS ' + Cypress.env('oktaMMAppToken');

function buildProfile(user) {
    const profile = {
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

Cypress.Commands.add('oktaCreateUser', (user = {}) => {
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
    }).then((response) => {
        expect(response.status).to.equal(200);
        const userId = response.data.id;
        return cy.wrap(userId);
    });
});

Cypress.Commands.add('oktaGetUser', (userId = '') => {
    return cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users?q=' + userId,
        method: 'get',
        token,
    }).then((response) => {
        expect(response.status).to.be.equal(200);
        if (response.data.length > 0) {
            return cy.wrap(response.data[0].id);
        }
        return cy.wrap(null);
    });
});

Cypress.Commands.add('oktaUpdateUser', (userId = '', user = {}) => {
    const profile = buildProfile(user);

    return cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users/' + userId,
        method: 'post',
        token,
        data: {
            profile,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap(response.data);
    });
});

//first we deactivate the user, then we actually delete it
Cypress.Commands.add('oktaDeleteUser', (userId = '') => {
    cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users/' + userId,
        method: 'delete',
        token,
    }).then((response) => {
        expect(response.status).to.equal(204);
        expect(response.data).is.empty;
        cy.task('oktaRequest', {
            baseUrl: Cypress.env('oktaApiUrl'),
            urlSuffix: '/users/' + userId,
            method: 'delete',
            token,
        }).then((_response) => {
            expect(_response.status).to.equal(204);
            expect(_response.data).is.empty;
        });
    });
});

Cypress.Commands.add('oktaDeleteSession', (userId = '') => {
    cy.task('oktaRequest', {
        baseUrl: Cypress.env('oktaApiUrl'),
        urlSuffix: '/users/' + userId + '/sessions',
        method: 'delete',
        token,
    }).then((response) => {
        expect(response.status).to.equal(204);
        expect(response.data).is.empty;

        // Ensure we clear out these specific cookies
        ['JSESSIONID'].forEach((cookie) => {
            cy.clearCookie(cookie);
        });
    });
});

Cypress.Commands.add('oktaAssignUserToApplication', (userId = '', user = {}) => {
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
    }).then((response) => {
        expect(response.status).to.be.equal(200);
        return cy.wrap(response.data);
    });
});

Cypress.Commands.add('oktaGetOrCreateUser', (user) => {
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
        return cy.wrap(userId);
    });
});

Cypress.Commands.add('oktaAddUsers', (users) => {
    let userId;
    Object.values(users.regulars).forEach((_user) => {
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

    Object.values(users.guests).forEach((_user) => {
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

    Object.values(users.admins).forEach((_user) => {
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
});

Cypress.Commands.add('oktaRemoveUsers', (users) => {
    let userId;
    Object.values(users.regulars).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId);
            }
        });
    });

    Object.values(users.guests).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId);
            }
        });
    });

    Object.values(users.admins).forEach((_user) => {
        cy.oktaGetUser(_user.email).then((_uId) => {
            userId = _uId;
            if (userId != null) {
                cy.oktaDeleteUser(userId);
            }
        });
    });
});

Cypress.Commands.add('checkOktaLoginPage', () => {
    cy.findByText('Powered by').should('be.visible');
    cy.findAllByText('Sign In').should('be.visible');
    cy.get('#okta-signin-password').should('be.visible');
    cy.get('#okta-signin-submit').should('be.visible');
});

Cypress.Commands.add('doOktaLogin', (user) => {
    cy.checkOktaLoginPage();

    cy.get('#okta-signin-username').type(user.email);
    cy.get('#okta-signin-password').type(user.password);
    cy.findAllByText('Sign In').last().click().wait(TIMEOUTS.FIVE_SEC);
});
