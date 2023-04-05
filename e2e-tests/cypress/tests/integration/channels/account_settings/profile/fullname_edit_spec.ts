// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

describe('Profile > Profile Settings > Full Name', () => {
    let testUser;

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({user, offTopicUrl}) => {
            testUser = user;
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T2043 Enter first name', () => {
        // # Go to Profile
        cy.uiOpenProfileModal('Profile Settings');

        // # Click "Edit" to the right of "Full Name"
        cy.get('#nameEdit').should('be.visible').click();

        // # Clear the first name
        cy.get('#firstName').clear();

        // # Type a new first name
        cy.get('#firstName').should('be.visible').type(testUser.first_name + '_new');

        // # Save the settings
        cy.uiSave();

        // * Check that the first name was correctly updated
        cy.get('#nameDesc').should('be.visible').should('contain', testUser.first_name + '_new ' + testUser.last_name);

        // # Close the modal
        cy.uiClose();
    });

    it('MM-T2042 Full Name starting blank stays blank', () => {
        // # Go to Profile
        cy.uiOpenProfileModal('Profile Settings');

        // # Click "Edit" to the right of "Full Name"
        cy.get('#nameEdit').should('be.visible').click();

        // # Clear the first name
        cy.get('#firstName').should('be.visible').clear();

        // # Clear the last name
        cy.get('#lastName').should('be.visible').clear();

        // # Save the settings
        cy.uiSave();

        // # Click "Edit" to the right of "Full Name"
        cy.get('#nameEdit').should('be.visible').click();

        // # Save the settings
        cy.uiSave();

        // * Check that the full name was correctly cleared
        cy.findByText("Click 'Edit' to add your full name").should('be.visible');

        // # Click "Edit" to the right of "Full Name"
        cy.get('#nameEdit').should('be.visible').click();

        // * Check that first name is blank
        cy.get('#firstName').should('be.visible').should('have.value', '');

        // * Check that last name is blank
        cy.get('#lastName').should('be.visible').should('have.value', '');

        // # Close the modal
        cy.uiClose();
    });
});
