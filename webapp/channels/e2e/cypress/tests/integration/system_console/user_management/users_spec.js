// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @system_console

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('System Console > User Management > Users', () => {
    let testUser;
    let otherAdmin;

    before(() => {
        cy.apiInitSetup().then(({user}) => {
            testUser = user;
        });

        // # Create other sysadmin
        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            otherAdmin = sysadmin;
        });
    });

    beforeEach(() => {
        // # Login as other admin.
        cy.apiLogin(otherAdmin);

        // # Visit the system console.
        cy.visit('/admin_console');

        // # Go to the User management/Users section.
        cy.findByTestId('user_management.system_users').
            click().
            wait(TIMEOUTS.ONE_SEC);
    });

    it('MM-T925 Users - Profile image on User Configuration page is round', () => {
        // # Find the created user by entering in the search
        cy.findByPlaceholderText('Search users').
            should('be.visible').
            clear().
            type(testUser.email).
            wait(TIMEOUTS.HALF_SEC);

        // # Click on the searched user name
        cy.findByText(`@${testUser.username}`).
            should('be.visible').
            click({force: true});

        // * Verify we landed on the user configuration page
        cy.location('pathname').should(
            'equal',
            `/admin_console/user_management/user/${testUser.id}`,
        );

        // * Verify that user profile image is round
        cy.findByAltText('user profile image').
            should('be.visible').
            and('have.css', 'border-radius', '50%');
    });

    it('MM-T932 Users - Change a user\'s password', () => {
        // # Search for the user.
        cy.get('#searchUsers').type(testUser.email).wait(TIMEOUTS.HALF_SEC);

        // # Open the actions menu.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .text-right a').
            click().wait(TIMEOUTS.HALF_SEC);

        // # Click the Reset Password menu option.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .MenuWrapperAnimation-enter-done').
            find('li').eq(3).click().wait(TIMEOUTS.HALF_SEC);

        // # Type new password and submit.
        cy.get('input[type=password]').type('new' + testUser.password);
        cy.get('button[type=submit]').should('contain', 'Reset').click().wait(TIMEOUTS.HALF_SEC);

        // # Log out.
        cy.apiLogout();

        // * Verify that logging in with old password returns an error.
        apiLogin(testUser.username, testUser.password).then((response) => {
            expect(response.status).to.equal(401);

            // * Verify that logging in with the updated password works.
            testUser.password = 'new' + testUser.password;
            cy.apiLogin(testUser);

            // # Log out.
            cy.apiLogout();
        });
    });

    it('MM-T933 Users - System admin changes own password - Cancel out of changes', () => {
        // # Search for the admin.
        cy.get('#searchUsers').type(otherAdmin.username).wait(TIMEOUTS.HALF_SEC);

        // # Open the actions menu.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .text-right a').
            click().wait(TIMEOUTS.HALF_SEC);

        // # Click the Reset Password menu option.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .MenuWrapperAnimation-enter-done').
            find('li').eq(2).click().wait(TIMEOUTS.HALF_SEC);

        // # Type current password and a new password.
        cy.get('input[type=password]').eq(0).type(otherAdmin.password);
        cy.get('input[type=password]').eq(1).type('new' + otherAdmin.password);

        // # Click the 'Cancel' button.
        cy.get('button[type=button].btn.btn-link').should('contain', 'Cancel').click().wait(TIMEOUTS.HALF_SEC);

        // # Log out.
        cy.apiLogout();

        // * Verify that logging in with the old password works.
        cy.apiLogin(otherAdmin);
    });

    it('MM-T934 Users - System admin changes own password - Incorrect old password', () => {
        // # Search for the admin.
        cy.get('#searchUsers').type(otherAdmin.username).wait(TIMEOUTS.HALF_SEC);

        // # Open the actions menu.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .text-right a').
            click().wait(TIMEOUTS.HALF_SEC);

        // # Click the Reset Password menu option.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .MenuWrapperAnimation-enter-done').
            find('li').eq(2).click().wait(TIMEOUTS.HALF_SEC);

        // # Type wrong current password and a new password.
        cy.get('input[type=password]').eq(0).type('wrong' + otherAdmin.password);
        cy.get('input[type=password]').eq(1).type('new' + otherAdmin.password);

        // # Click the 'Reset' button.
        cy.get('button[type=submit] span').should('contain', 'Reset').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify the appropriate error is returned.
        cy.get('form.form-horizontal').find('.has-error p.error').should('be.visible').
            and('contain', 'The "Current Password" you entered is incorrect. Please check that Caps Lock is off and try again.');
    });

    it('MM-T935 Users - System admin changes own password - Invalid new password', () => {
        // # Search for the admin.
        cy.get('#searchUsers').type(otherAdmin.username).wait(TIMEOUTS.HALF_SEC);

        // # Open the actions menu.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .text-right a').
            click().wait(TIMEOUTS.HALF_SEC);

        // # Click the Reset Password menu option.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .MenuWrapperAnimation-enter-done').
            find('li').eq(2).click().wait(TIMEOUTS.HALF_SEC);

        // # Type current password and a new too short password.
        cy.get('input[type=password]').eq(0).type(otherAdmin.password);
        cy.get('input[type=password]').eq(1).type('new');

        // # Click the 'Reset' button.
        cy.get('button[type=submit] span').should('contain', 'Reset').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify the appropriate error is returned.
        cy.get('form.form-horizontal').find('.has-error p.error').should('be.visible').
            and('contain', 'Must be 5-64 characters long.');
    });

    it('MM-T936 Users - System admin changes own password - Blank fields', () => {
        // # Search for the admin.
        cy.get('#searchUsers').type(otherAdmin.username).wait(TIMEOUTS.HALF_SEC);

        // # Open the actions menu.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .text-right a').
            click().wait(TIMEOUTS.HALF_SEC);

        // # Click the Reset Password menu option.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .MenuWrapperAnimation-enter-done').
            find('li').eq(2).click().wait(TIMEOUTS.HALF_SEC);

        // # Click the 'Reset' button.
        cy.get('button[type=submit] span').should('contain', 'Reset').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify the appropriate error is returned.
        cy.get('form.form-horizontal').find('.has-error p.error').should('be.visible').
            and('contain', 'Please enter your current password.');

        // # Type current password, leave new password blank.
        cy.get('input[type=password]').eq(0).type(otherAdmin.password);

        // # Click the 'Reset' button.
        cy.get('button[type=submit] span').should('contain', 'Reset').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify the appropriate error is returned.
        cy.get('form.form-horizontal').find('.has-error p.error').should('be.visible').
            and('contain', 'Must be 5-64 characters long.');
    });

    it('MM-T937 Users - System admin changes own password - Successfully changed', () => {
        // # Search for the admin.
        cy.get('#searchUsers').type(otherAdmin.username).wait(TIMEOUTS.HALF_SEC);

        // # Open the actions menu.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .text-right a').
            click().wait(TIMEOUTS.HALF_SEC);

        // # Click the Reset Password menu option.
        cy.get('[data-testid="userListRow"] .more-modal__right .more-modal__actions .MenuWrapper .MenuWrapperAnimation-enter-done').
            find('li').eq(2).click().wait(TIMEOUTS.HALF_SEC);

        // # Type current and new passwords..
        cy.get('input[type=password]').eq(0).type(otherAdmin.password);
        cy.get('input[type=password]').eq(1).type('new' + otherAdmin.password);

        // # Click the 'Reset' button.
        cy.get('button[type=submit] span').should('contain', 'Reset').click().wait(TIMEOUTS.HALF_SEC);

        // # Log out.
        cy.apiLogout();

        // * Verify that logging in with old password returns an error.
        apiLogin(otherAdmin.username, otherAdmin.password).then((response) => {
            expect(response.status).to.equal(401);

            // * Verify that logging in with new password works.
            otherAdmin.password = 'new' + otherAdmin.password;
            cy.apiLogin(otherAdmin);

            // # Reset admin's password to the original.
            cy.apiResetPassword('me', otherAdmin.password, otherAdmin.password.substr(3));
        });
    });
});

function apiLogin(username, password) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/login',
        method: 'POST',
        body: {login_id: username, password},
        failOnStatusCode: false,
    });
}
