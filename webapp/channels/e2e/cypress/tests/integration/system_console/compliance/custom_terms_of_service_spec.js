// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @system_console

describe('Custom Terms of Service', () => {
    let testUser;
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;
        });
    });

    it('MM-T1190 - Appears after creating new account and verifying email address', () => {
        const customTermsOfServiceText = 'Test custom terms of service';

        // # Verify new user email
        cy.apiVerifyUserEmailById(testUser.id);

        // # Login as admin
        cy.apiAdminLogin();

        cy.apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: true,
            },
        });

        // # Visit custom terms of service page
        cy.visit('/admin_console/compliance/custom_terms_of_service');

        // # Enable custom terms of service
        cy.findByTestId('SupportSettings.CustomTermsOfServiceEnabledtrue').click();

        // # Set the terms of service to the first value
        cy.findByTestId('SupportSettings.CustomTermsOfServiceTextinput').clear().type(customTermsOfServiceText);

        // # Save config
        cy.get('#saveSetting').click();

        // # Login as the test user
        cy.apiLogin(testUser);

        // # Visit the test team town square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // * Ensure that the terms of service text shows as expected
        cy.findByTestId('termsOfService').should('be.visible').and('contain.text', customTermsOfServiceText);

        // * Ensure that the accept terms button is visible and click it
        cy.get('#acceptTerms').should('be.visible').click();

        // * Ensure the user is redirected to the appropriate team after terms are accepted
        cy.url().should('include', `/${testTeam.name}/channels/town-square`);
    });

    it('MM-T1191 - Repeated edits must be agreed to', () => {
        const firstTOS = 'First custom terms of service';
        const secondTOS = 'Second custom terms of service';

        // # Login as admin
        cy.apiAdminLogin();

        // # Reset config via the API from previous test
        cy.apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: false,
            },
            SupportSettings: {
                CustomTermsOfServiceEnabled: false,
            },
        });

        // # Visit custom terms of service page
        cy.visit('/admin_console/compliance/custom_terms_of_service');

        // # Enable custom terms of service
        cy.findByTestId('SupportSettings.CustomTermsOfServiceEnabledtrue').click();

        // # Set the terms of service to the first value
        cy.findByTestId('SupportSettings.CustomTermsOfServiceTextinput').clear().type(firstTOS);

        // # Save config
        cy.get('#saveSetting').click();

        // # Accept the terms as sysadmin
        cy.get('#acceptTerms').should('be.visible').click();

        // * Should be redirected back to custom terms of service page
        cy.url().should('include', '/admin_console/compliance/custom_terms_of_service');

        // # Login as the test user
        cy.apiLogin(testUser);

        // # Visit the test team town square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // * Ensure that the first terms of service is visible
        cy.findByTestId('termsOfService').should('be.visible').and('contain.text', firstTOS);

        // # Login as admin
        cy.apiAdminLogin();

        // # Visit custom terms of service page
        cy.visit('/admin_console/compliance/custom_terms_of_service');

        // # Set the terms of service to the first value
        cy.findByTestId('SupportSettings.CustomTermsOfServiceTextinput').clear().type(secondTOS);

        // # Save config
        cy.get('#saveSetting').click();

        // * Ensure that the terms of service text shows as expected
        cy.findByTestId('termsOfService').should('be.visible').and('contain.text', secondTOS);

        // # Accept the terms as sysadmin
        cy.get('#acceptTerms').should('be.visible').click();

        // * Should be redirected back to custom terms of service page
        cy.url().should('include', '/admin_console/compliance/custom_terms_of_service');

        // # Login as the test user
        cy.apiLogin(testUser);

        // # Visit the test team town square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // * Ensure that the new terms of service is visible
        cy.findByTestId('termsOfService').should('be.visible').and('contain.text', secondTOS);

        // * Ensure that the accept terms button is visible and click it
        cy.get('#acceptTerms').should('be.visible').click();

        // * Ensure the user is redirected to the appropriate team after terms are accepted
        cy.url().should('include', `/${testTeam.name}/channels/town-square`);
    });
});
