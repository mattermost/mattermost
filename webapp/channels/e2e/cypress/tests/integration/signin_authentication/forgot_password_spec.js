// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @signin_authentication

import {
    getPasswordResetEmailTemplate,
    reUrl,
    verifyEmailBody,
} from '../../utils';

describe('Signin/Authentication', () => {
    let testUser;
    let teamName;

    before(() => {
        // # Do email test if setup properly
        cy.shouldHaveEmailEnabled();

        // # Create new team and users
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            teamName = team.name;

            cy.apiLogout();
        });
    });

    it('MM-T407 - Sign In Forgot password - Email address has account on server', () => {
        const newPassword = 'newpasswd';

        // # Visit town-square
        cy.visit(`/${teamName.name}/channels/town-square`);

        // * Verify that it redirects to /login
        cy.url().should('contain', '/login');

        // * Verify that forgot password link is present
        // # Click forgot password link
        cy.findByText('Forgot your password?').should('be.visible').click();

        // * Verify that it redirects to /reset_password
        cy.url().should('contain', '/reset_password');

        // * Verify that the focus is set to passwordResetEmailInput
        cy.focused().should('have.attr', 'id', 'passwordResetEmailInput');

        // # Type user email into email input field and click reset button
        cy.get('#passwordResetEmailInput').type(testUser.email);
        cy.get('#passwordResetButton').click();

        // * Should show that the  password reset email is sent
        cy.get('#passwordResetEmailSent').should('be.visible').within(() => {
            cy.get('span').first().should('have.text', 'If the account exists, a password reset email will be sent to:');
            cy.get('div b').first().should('have.text', testUser.email);
            cy.get('span').last().should('have.text', 'Please check your inbox.');
        });

        cy.getRecentEmail(testUser).then((data) => {
            const {body: actualEmailBody} = data;

            // * Verify contents of password reset email
            const expectedEmailBody = getPasswordResetEmailTemplate();
            verifyEmailBody(expectedEmailBody, actualEmailBody);

            const passwordResetLink = actualEmailBody[3].match(reUrl)[0];
            const token = passwordResetLink.split('token=')[1];

            // * Verify length of a token
            expect(token.length).to.equal(64);

            // # Visit password reset link (e.g. click on email link)
            cy.visit(passwordResetLink);
            cy.url().should('contain', '/reset_password_complete?token=');

            // * Verify that the focus is set to resetPasswordInput
            cy.focused().should('have.attr', 'id', 'resetPasswordInput');

            // # Type new password and click reset button
            cy.get('#resetPasswordInput').type(newPassword);
            cy.get('#resetPasswordButton').click();

            // * Verify that it redirects to /login?extra=password_change
            cy.url().should('contain', '/login?extra=password_change');

            // * Should show that the password is updated successfully
            cy.get('.AlertBanner.success').should('be.visible').and('have.text', ' Password updated successfully');

            // # Type email and new password, then click login button
            cy.get('#input_loginId').should('be.visible').type(testUser.username);
            cy.get('#input_password-input').should('be.visible').type(newPassword);
            cy.get('#saveSetting').click();

            // * Verify that it successfully logged in and redirects to /channels/town-square
            cy.url().should('contain', `/${teamName}/channels/town-square`);
        });
    });
});
