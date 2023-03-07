// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @system_console

import {
    getEmailResetEmailTemplate,
    getEmailVerifyEmailTemplate,
    getRandomId,
    verifyEmailBody,
} from '../../utils';

const TIMEOUTS = require('../../fixtures/timeouts');

describe('User Management', () => {
    const newUsername = 'u' + getRandomId();
    const newEmailAddr = newUsername + '@sample.mattermost.com';
    let testTeam;
    let testChannel;
    let sysadmin;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testChannel = channel;
            testTeam = team;
            testUser = user;
        });

        cy.apiAdminLogin().then((res) => {
            sysadmin = res.user;
        });
    });

    it('MM-T924 Users - Page through users list', () => {
        cy.apiGetUsers().then(({users}) => {
            const minimumNumberOfUsers = 60;

            if (users.length < minimumNumberOfUsers) {
                Cypress._.times(minimumNumberOfUsers - users.length, () => {
                    cy.apiCreateUser();
                });
            }
        });

        cy.visit('/admin_console/user_management/users');

        cy.get('#searchableUserListTotal').then((el) => {
            const count1 = el[0].innerText.replace(/\n/g, '').replace(/\s/g, ' ');

            // * Can page through several pages of users.
            cy.get('#searchableUserListNextBtn').should('be.visible').click();

            // * Count at top changes appropriately.
            cy.get('#searchableUserListTotal').then((el2) => {
                const count2 = el2[0].innerText.replace(/\n/g, '').replace(/\s/g, ' ');
                expect(count1).not.equal(count2);
            });

            // * Can page backward as well.
            cy.get('#searchableUserListPrevBtn').should('be.visible').click();
        });
    });

    it('MM-T928 Users - Change a user\'s email address', () => {
        cy.visit('/admin_console/user_management/users');

        // # Update config.
        cy.apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: true,
            },
        });

        // * Blank email address: "Please enter a valid email address"
        resetUserEmail(testUser.email, '', 'Please enter a valid email address');

        // * Invalid email address: "Please enter a valid email address"
        resetUserEmail(testUser.email, 'user-1(at)sample.mattermost.com', 'Please enter a valid email address');

        // * Email address already in use: "An account with that email already exists."
        resetUserEmail(testUser.email, 'sysadmin@sample.mattermost.com', 'An account with that email already exists.');
    });

    it('MM-T929 Users - Change a user\'s email address, with verification off', () => {
        cy.visit('/admin_console/user_management/users');

        // # Update config.
        cy.apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: false,
            },
        });

        // # System admin changes new user's email address.
        resetUserEmail(testUser.email, newEmailAddr, '');

        // # Updates immediately in Profile for the user.
        cy.get('#searchUsers').clear().type(newEmailAddr).wait(TIMEOUTS.HALF_SEC);
        cy.get('.more-modal__details').should('be.visible').within(() => {
            cy.findByText(newEmailAddr).should('exist');
        });

        // * User also receives email confirmation that email address has been changed.
        checkResetEmail(testUser, newEmailAddr);

        // # Logout, so that test user can login.
        cy.apiLogout();

        // * User cannot log in with old email address.
        apiLogin(testUser.email, testUser.password).then((response) => {
            expect(response.status).to.equal(401);

            // # User logs in with username /password (no verification needed), then logs out again
            cy.apiLogin({username: testUser.username, password: testUser.password}).apiLogout();

            // # User logs in with new email address /password (no verification needed)
            cy.apiLogin({username: newEmailAddr, password: testUser.password}).apiLogout();
        });

        // # Revert the changes.
        cy.apiAdminLogin();
        cy.visit('/admin_console/user_management/users');
        resetUserEmail(newEmailAddr, testUser.email, '');
    });

    it('MM-T930 Users - Change a user\'s email address, with verification on', () => {
        cy.visit('/admin_console/user_management/users');

        // # Update Configs.
        cy.apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: true,
            },
        });

        resetUserEmail(testUser.email, newEmailAddr, '');

        cy.apiLogout();

        // # Type email and password.
        cy.get('#input_loginId').type(testUser.email);
        cy.get('#input_password-input').type(testUser.password);
        cy.get('#saveSetting').should('not.be.disabled').click();

        // * Verify that logging in with the old e-mail works but requires e-mail verification.
        cy.url().should('include', 'should_verify_email');

        // # Log out.
        cy.apiLogout();

        // Verify e-mail.
        verifyEmail({username: newUsername, email: newEmailAddr});
        cy.wait(TIMEOUTS.HALF_SEC);

        // * Verify that logging in with the old e-mail works.
        cy.apiLogin({username: newEmailAddr, password: testUser.password}).apiLogout();

        // # Revert the config.
        cy.apiAdminLogin().apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: false,
            },
        });

        resetUserEmail(newEmailAddr, testUser.email, '');
    });

    it('MM-T931 Users - Can\'t update a user\'s email address if user has other signin method', () => {
        // # Update config.
        cy.apiUpdateConfig({
            GitLabSettings: {
                Enable: true,
            },
        });
        cy.visit('/admin_console/user_management/users');

        cy.apiCreateUser().then(({user: gitlabUser}) => {
            cy.apiUpdateUserAuth(gitlabUser.id, gitlabUser.email, '', 'gitlab');

            // # Search for the user.
            cy.get('#searchUsers').clear().type(gitlabUser.email).wait(TIMEOUTS.HALF_SEC);

            cy.findByTestId('userListRow').within(() => {
                // # Open the actions menu.
                cy.findByText('Member').click().wait(TIMEOUTS.HALF_SEC);

                // # Click the Update email menu option.
                cy.findByLabelText('User Actions Menu').findByText('Update Email').should('not.exist');
            });
        });
    });

    it('MM-T941 Users - Revoke all sessions for unreachable users', () => {
        // # Login as a system user - User
        cy.apiLogin(testUser);

        // Visit the test channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Revoke all sessions for the user
        cy.externalRequest({user: sysadmin, method: 'post', path: `users/${testUser.id}/sessions/revoke/all`});

        // # Visit default page and wait until it's redirected to login page
        cy.visit('/');
        cy.waitUntil(() => cy.url().then((url) => {
            return url.includes('/login');
        }), {timeout: TIMEOUTS.HALF_MIN});

        // # Check if user's session is automatically logged out and the user is redirected to the login page
        cy.url().should('contain', '/login');
    });

    function resetUserEmail(oldEmail, newEmail, errorMsg) {
        cy.visit('/admin_console/user_management/users');

        // # Search for the user.
        cy.get('#searchUsers').clear().type(oldEmail).wait(TIMEOUTS.HALF_SEC);

        cy.findByTestId('userListRow').within(() => {
            // # Open the actions menu.
            cy.findByText('Member').click().wait(TIMEOUTS.HALF_SEC);

            // # Click the Update email menu option.
            cy.findByLabelText('User Actions Menu').findByText('Update Email').click().wait(TIMEOUTS.HALF_SEC);
        });

        // # Verify the modal opened.
        cy.findByTestId('resetEmailModal').should('exist');

        // # Type the new e-mail address.
        if (newEmail.length > 0) {
            cy.get('input[type=email]').eq(0).clear().type(newEmail);
        }

        // # Click the "Reset" button.
        cy.findByTestId('resetEmailButton').click();

        // * Check for the error messages, if any.
        if (errorMsg.length > 0) {
            cy.get('form.form-horizontal').find('.has-error p.error').should('be.visible').and('contain', errorMsg);

            // # Close the modal.
            cy.findByLabelText('Close').click();
        }
    }

    function checkResetEmail(user, newEmail) {
        cy.getRecentEmail(user).then((data) => {
            const {body: actualEmailBody, subject} = data;

            // # Verify that the email subject is as expected.
            expect(subject).to.contain('Your email address has changed');

            // # Verify email body
            const expectedEmailBody = getEmailResetEmailTemplate(newEmail);
            verifyEmailBody(expectedEmailBody, actualEmailBody);
        });
    }

    function verifyEmail(user) {
        const baseUrl = Cypress.config('baseUrl');

        // # Verify e-mail through verification link.
        cy.getRecentEmail(user).then((data) => {
            const {body: actualEmailBody, subject} = data;

            // # Verify that the email subject is as expected.
            expect(subject).to.contain('Email Verification');

            // # Verify email body
            const expectedEmailBody = getEmailVerifyEmailTemplate(user.email);
            verifyEmailBody(expectedEmailBody, actualEmailBody);

            // # Extract verification the link from the e-mail.
            const line = actualEmailBody[4].split(' ');
            const verificationLink = line[3].replace(baseUrl, '');

            // # Complete verification.
            cy.visit(verificationLink);
            cy.findByText('Email Verified').should('be.visible');
            cy.get('#input_loginId').should('be.visible').and('have.value', user.email);
        });
    }

    function apiLogin(username, password) {
        return cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: '/api/v4/users/login',
            method: 'POST',
            body: {login_id: username, password},
            failOnStatusCode: false,
        });
    }
});
