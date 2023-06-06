// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import authenticator from 'authenticator';

import {getRandomId} from '../../utils';
import {getAdminAccount} from '../env';

import {buildQueryString} from './helpers';

// *****************************************************************************
// Users
// https://api.mattermost.com/#tag/users
// *****************************************************************************

Cypress.Commands.add('apiLogin', (user, requestOptions = {}) => {
    return cy.request({
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
            return cy.wrap({
                user: {
                    ...response.body,
                    password: user.password,
                },
            });
        }

        return cy.wrap({error: response.body});
    });
});

Cypress.Commands.add('apiLoginWithMFA', (user, token) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/login',
        method: 'POST',
        body: {login_id: user.username, password: user.password, token},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({
            user: {
                ...response.body,
                password: user.password,
            },
        });
    });
});

Cypress.Commands.add('apiAdminLogin', (requestOptions = {}) => {
    const admin = getAdminAccount();

    // First, login with username
    cy.apiLogin(admin, requestOptions).then((resp) => {
        if (resp.error) {
            if (resp.error.id === 'mfa.validate_token.authenticate.app_error') {
                // On fail, try to login via MFA
                return cy.dbGetUser({username: admin.username}).then(({user: {mfasecret}}) => {
                    const token = authenticator.generateToken(mfasecret);
                    return cy.apiLoginWithMFA(admin, token);
                });
            }

            // Or, try to login via email
            delete admin.username;
            return cy.apiLogin(admin, requestOptions);
        }

        return resp;
    });
});

Cypress.Commands.add('apiAdminLoginWithMFA', (token) => {
    const admin = getAdminAccount();

    return cy.apiLoginWithMFA(admin, token);
});

Cypress.Commands.add('apiLogout', () => {
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
});

Cypress.Commands.add('apiGetMe', () => {
    return cy.apiGetUserById('me');
});

Cypress.Commands.add('apiGetUserById', (userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/' + userId,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
});

Cypress.Commands.add('apiGetUserByEmail', (email, failOnStatusCode = true) => {
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
});

Cypress.Commands.add('apiGetUsersByUsernames', (usernames = []) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/usernames',
        method: 'POST',
        body: usernames,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({users: response.body});
    });
});

Cypress.Commands.add('apiPatchUser', (userId, userData) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/users/${userId}/patch`,
        body: userData,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
});

Cypress.Commands.add('apiPatchMe', (data) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/me/patch',
        method: 'PUT',
        body: data,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
});

Cypress.Commands.add('apiCreateCustomAdmin', ({loginAfter = false, hideAdminTrialModal = true} = {}) => {
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
});

Cypress.Commands.add('apiCreateAdmin', () => {
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
});

function generateRandomUser(prefix = 'user') {
    const randomId = getRandomId();

    return {
        email: `${prefix}${randomId}@sample.mattermost.com`,
        username: `${prefix}${randomId}`,
        password: 'passwd',
        first_name: `First${randomId}`,
        last_name: `Last${randomId}`,
        nickname: `Nickname${randomId}`,
    };
}

Cypress.Commands.add('apiCreateUser', ({
    prefix = 'user',
    bypassTutorial = true,
    hideActionsMenu = true,
    hideOnboarding = true,
    bypassWhatsNewModal = true,
    user = null,
} = {}) => {
    const newUser = user || generateRandomUser(prefix);

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
            cy.apiSaveTutorialStep(createdUser.id, '999');
        }

        if (hideActionsMenu) {
            cy.apiSaveActionsMenuPreference(createdUser.id, true);
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
});

Cypress.Commands.add('apiCreateGuestUser', ({
    prefix = 'guest',
    bypassTutorial = true,
} = {}) => {
    return cy.apiCreateUser({prefix, bypassTutorial}).then(({user}) => {
        cy.apiDemoteUserToGuest(user.id);

        return cy.wrap({guest: user});
    });
});

/**
 * Revoke all active sessions for a user
 * @param {String} userId - ID of user to revoke sessions
 */
Cypress.Commands.add('apiRevokeUserSessions', (userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/sessions/revoke/all`,
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({data: response.body});
    });
});

Cypress.Commands.add('apiGetUsers', (queryParams = {}) => {
    const queryString = buildQueryString(queryParams);

    return cy.request({
        method: 'GET',
        url: `/api/v4/users?${queryString}`,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({users: response.body});
    });
});

Cypress.Commands.add('apiGetUsersNotInTeam', ({teamId, page = 0, perPage = 60} = {}) => {
    return cy.apiGetUsers({not_in_team: teamId, page, per_page: perPage});
});

Cypress.Commands.add('apiPatchUserRoles', (userId, roleNames = ['system_user']) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/roles`,
        method: 'PUT',
        body: {roles: roleNames.join(' ')},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
});

Cypress.Commands.add('apiDeactivateUser', (userId) => {
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
});

Cypress.Commands.add('apiActivateUser', (userId) => {
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
});

Cypress.Commands.add('apiDemoteUserToGuest', (userId) => {
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
});

Cypress.Commands.add('apiPromoteGuestToUser', (userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/promote`,
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.apiGetUserById(userId);
    });
});

/**
 * Verify a user email via API
 * @param {String} userId - ID of user of email to verify
 */
Cypress.Commands.add('apiVerifyUserEmailById', (userId) => {
    const options = {
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
        url: `/api/v4/users/${userId}/email/verify/member`,
    };

    return cy.request(options).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({user: response.body});
    });
});

Cypress.Commands.add('apiActivateUserMFA', (userId, activate, token) => {
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
});

Cypress.Commands.add('apiResetPassword', (userId, currentPass, newPass) => {
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
});

Cypress.Commands.add('apiGenerateMfaSecret', (userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
        url: `/api/v4/users/${userId}/mfa/generate`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({code: response.body});
    });
});

Cypress.Commands.add('apiAccessToken', (userId, description) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/' + userId + '/tokens',
        method: 'POST',
        body: {
            description,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body);
    });
});

Cypress.Commands.add('apiRevokeAccessToken', (tokenId) => {
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
});

Cypress.Commands.add('apiUpdateUserAuth', (userId, authData, password, authService) => {
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
});

Cypress.Commands.add('apiGetTotalUsers', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'GET',
        url: '/api/v4/users/stats',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body.total_users_count);
    });
});

export {generateRandomUser};
