// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @signin_authentication

describe('SignIn Authentication', () => {
    let testUser;

    before(() => {
        // # Create new user
        cy.apiInitSetup().then(({user}) => {
            testUser = user;

            cy.apiLogout();
            cy.visit('/login');

            // # Remove autofocus from login input
            cy.get('.login-body-card-content').should('be.visible').focus();
        });
    });

    it('MM-T3080 Sign in email/pwd account', () => {
        // # Enter actual user's email in the email field
        cy.apiGetClientLicense().then(({isLicensed}) => {
            const loginPlaceholder = isLicensed ? 'Email, Username or AD/LDAP Username' : 'Email or Username';
            cy.findByPlaceholderText(loginPlaceholder).clear().type(testUser.email);

            // # Enter user's password in the password field
            cy.findByPlaceholderText('Password').clear().type(testUser.password);

            // # Click Sign In to login
            cy.get('#saveSetting').should('not.be.disabled').click();

            // * Check that it login successfully and it redirects into the main channel page
            cy.url().should('include', '/channels/town-square');

            // # Click logout via user menu
            cy.uiOpenUserMenu('Log Out');

            // * Check that it logout successfully and it redirects into the login page
            cy.url().should('include', '/login');

            // # Remove autofocus from login input
            cy.get('.login-body-card-content').should('be.visible').focus();

            // # Enter actual user's username in the email field
            cy.findByPlaceholderText(loginPlaceholder).clear().type(testUser.username);

            // # Enter user's password in the password field
            cy.findByPlaceholderText('Password').clear().type(testUser.password);

            // # Click Sign In to login
            cy.get('#saveSetting').should('not.be.disabled').click();

            // * Check that it login successfully and it redirects into the main channel page
            cy.url().should('include', '/channels/town-square');
        });
    });
});
