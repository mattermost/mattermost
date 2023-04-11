// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @profile_settings

describe('Profile Settings', () => {
    let testUser;

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({prefix: 'other', loginAfter: true}).then(({offTopicUrl, user}) => {
            cy.visit(offTopicUrl);
            testUser = user;
        });
    });

    it('MM-T2044 Clear fields, values revert', () => {
        cy.uiOpenProfileModal('Profile Settings');

        // # Click "Edit" to the right of "Full Name"
        cy.get('#nameEdit').should('be.visible').click();

        // # Clear the first name
        cy.get('#firstName').clear();

        // # Type a new first name
        cy.get('#firstName').should('be.visible').type('newFirstName');

        // # Clear the last name
        cy.get('#lastName').should('be.visible').clear();

        // # Type a new last name
        cy.get('#lastName').should('be.visible').type('newLastName');

        // # Click 'Cancel'
        cy.uiCancel();

        // * Check that the full name was not updated since it was not saved
        cy.get('#nameDesc').should('be.visible').should('contain', testUser.first_name + ' ' + testUser.last_name);

        // # Close the modal
        cy.uiClose();
    });
});
