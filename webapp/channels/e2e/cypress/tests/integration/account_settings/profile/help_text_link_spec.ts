// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @account_setting

describe('Account Settings', () => {
    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T2045 Full Name - Link in help text', () => {
        // # Go to Profile
        cy.uiOpenProfileModal();

        // * Ensure that the Profile tab is loaded
        cy.get('#generalSettingsTitle').should('be.visible').should('contain', 'Profile');

        // # Click "Edit" to the right of Full Name
        cy.get('#nameEdit').click();

        // # Click "Notifications" link in help text
        cy.get('#extraInfo').within(() => {
            cy.findByText('Notifications').click();
        });

        // * Verify that the modal switched to "Profile" modal
        cy.findByRole('dialog', {name: 'Profile'}).should('be.visible');

        // * Verify that the view switches to notifications tab
        cy.get('#notificationSettingsTitle').should('be.visible').should('contain', 'Notifications');
    });
});
