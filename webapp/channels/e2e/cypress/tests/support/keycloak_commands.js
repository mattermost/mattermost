// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

Cypress.Commands.add('keycloakGetAccessTokenAPI', () => {
    return cy.task('keycloakRequest', {
        baseUrl: loginUrl,
        path: '',
        method: 'post',
        headers: {'Content-type': 'application/x-www-form-urlencoded'},
        data: 'grant_type=password&username=mmuser&password=mostest&client_id=admin-cli',
    }).then((response) => {
        expect(response.status).to.equal(200);
        const token = response.data.access_token;
        return cy.wrap(token);
    });
});

Cypress.Commands.add('keycloakCreateUserAPI', (accessToken, user = {}) => {
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
    }).then((response) => {
        expect(response.status).to.equal(201);
    });
});

Cypress.Commands.add('keycloakResetPasswordAPI', (accessToken, userId, password) => {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: `users/${userId}/reset-password`,
        method: 'put',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        data: {type: 'password', temporary: false, value: password},
    }).then((response) => {
        if (response.status === 200 && response.data.length > 0) {
            return cy.wrap(response.data[0].id);
        }
        return null;
    });
});

Cypress.Commands.add('keycloakGetUserAPI', (accessToken, email) => {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: 'users?email=' + email,
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((response) => {
        if (response.status === 200 && response.data.length > 0) {
            return cy.wrap(response.data[0].id);
        }
        return null;
    });
});

Cypress.Commands.add('keycloakDeleteUserAPI', (accessToken, userId) => {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: `users/${userId}`,
        method: 'delete',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((response) => {
        expect(response.status).to.equal(204);
        expect(response.data).is.empty;
    });
});

Cypress.Commands.add('keycloakUpdateUserAPI', (accessToken, userId, data) => {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: 'users/' + userId,
        method: 'put',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        data,
    }).then((response) => {
        expect(response.status).to.equal(204);
        expect(response.data).is.empty;
    });
});

Cypress.Commands.add('keycloakDeleteSessionAPI', (accessToken, sessionId) => {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: `sessions/${sessionId}`,
        method: 'delete',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((delResponse) => {
        expect(delResponse.status).to.equal(204);
        expect(delResponse.data).is.empty;
    });
});

Cypress.Commands.add('keycloakGetUserSessionsAPI', (accessToken, userId) => {
    return cy.task('keycloakRequest', {
        baseUrl,
        path: `users/${userId}/sessions`,
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.data);
        return cy.wrap(response.data);
    });
});

Cypress.Commands.add('keycloakDeleteUserSessions', (accessToken, userId) => {
    return cy.keycloakGetUserSessionsAPI(accessToken, userId).then((responseData) => {
        if (responseData.length > 0) {
            Object.values(responseData).forEach((data) => {
                const sessionId = data.id;
                cy.keycloakDeleteSession(accessToken, sessionId);
            });

            // Ensure we clear out these specific cookies
            ['JSESSIONID'].forEach((cookie) => {
                cy.clearCookie(cookie);
            });
        }
    });
});

Cypress.Commands.add('keycloakResetUsers', (users) => {
    return cy.keycloakGetAccessTokenAPI().then((accessToken) => {
        Object.values(users).forEach((_user) => {
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
});

Cypress.Commands.add('keycloakCreateUser', (accessToken, user) => {
    return cy.keycloakCreateUserAPI(accessToken, user).then(() => {
        cy.keycloakGetUserAPI(accessToken, user.email).then((newId) => {
            cy.keycloakResetPasswordAPI(accessToken, newId, user.password).then(() => {
                cy.keycloakDeleteUserSessions(accessToken, newId).then(() => {
                    return cy.wrap(newId);
                });
            });
        });
    });
});

Cypress.Commands.add('keycloakCreateUsers', (users = []) => {
    return cy.keycloakGetAccessTokenAPI().then((accessToken) => {
        return users.forEach((user) => {
            return cy.keycloakCreateUser(accessToken, user);
        });
    });
});

Cypress.Commands.add('keycloakUpdateUser', (userEmail, data) => {
    return cy.keycloakGetAccessTokenAPI().then((accessToken) => {
        return cy.keycloakGetUserAPI(accessToken, userEmail).then((userId) => {
            return cy.keycloakUpdateUserAPI(accessToken, userId, data);
        });
    });
});

Cypress.Commands.add('keycloakSuspendUser', (userEmail) => {
    const data = {enabled: false};
    cy.keycloakUpdateUser(userEmail, data);
});

Cypress.Commands.add('keycloakUnsuspendUser', (userEmail) => {
    const data = {enabled: true};
    cy.keycloakUpdateUser(userEmail, data);
});

Cypress.Commands.add('checkKeycloakLoginPage', () => {
    cy.findByText('Username or email', {timeout: TIMEOUTS.ONE_SEC}).should('be.visible');
    cy.findByText('Password').should('be.visible');
    cy.findAllByText('Log In').should('be.visible');
});

Cypress.Commands.add('doKeycloakLogin', (user) => {
    cy.apiLogout();
    cy.visit('/login');
    cy.findByText('SAML').click();
    cy.findByText('Username or email').type(user.email);
    cy.findByText('Password').type(user.password);
    cy.findAllByText('Log In').last().click();
});

Cypress.Commands.add('verifyKeycloakLoginFailed', () => {
    cy.findAllByText('Account is disabled, contact your administrator.').should('be.visible');
});
