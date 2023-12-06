// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console @not_cloud

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('System Console > User Management > Deactivation', () => {
    let testUser;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // # Do initial setup
        cy.apiInitSetup().then(({user}) => {
            testUser = user;
        });

        // # Visit the system console.
        cy.visit('/admin_console');
    });

    it('MM-T947 When deactivating users in the System Console, email address should not disappear', () => {
        // # Go to User management / Users tab
        cy.findByTestId('user_management.system_users').should('be.visible').click();

        // # Search the newly created user in the search box
        cy.findByPlaceholderText('Search users').should('be.visible').clear().type(testUser.email).wait(TIMEOUTS.HALF_SEC);

        // * Verify that user is listed
        cy.findByText(`@${testUser.username}`).should('be.visible');

        // # Scan on the first item's row in the list
        cy.findByTestId('userListRow').should('be.visible').within(() => {
            // * Verify before deactivation email is visible
            cy.findByText(testUser.email).should('be.visible');

            // # Open the actions menu.
            cy.findByText('Member').click().wait(TIMEOUTS.HALF_SEC);

            // # Click on deactivate menu button
            cy.findByLabelText('User Actions Menu').findByText('Deactivate').click();
        });

        // # Click confirm deactivate in the modal
        cy.get('.a11y__modal').should('exist').and('be.visible').within(() => {
            cy.findByText('Deactivate').should('be.visible').click();
        });

        cy.findByTestId('userListRow').should('be.visible').within(() => {
            // * Verify that the user is now inactive
            cy.findByText('Inactive').should('be.visible');

            // * Verify once again if email is visible
            cy.findByText(testUser.email).should('be.visible');
        });
    });
});
