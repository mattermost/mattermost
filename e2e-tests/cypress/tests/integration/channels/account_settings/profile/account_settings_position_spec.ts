// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

describe('Profile > Profile Settings > Position', () => {
    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            // # Visit off-topic channel
            cy.visit(offTopicUrl);

            // # Post message in the main channel
            cy.postMessage('hello from master hacker');
        });
    });

    it('MM-T2063 Position', () => {
        const position = 'Master hacker';

        // # Open 'Profile' modal and view the default 'Profile Settings'
        cy.uiOpenProfileModal('Profile Settings').within(() => {
            // # Open 'Position' setting
            cy.findByRole('heading', {name: 'Position'}).should('be.visible').click();

            // # Enter new 'Position'
            cy.findByRole('textbox', {name: 'Position'}).
                should('be.visible').
                and('be.focused').
                type(position).
                should('have.value', position);

            // # Save and close the modal
            cy.uiSaveAndClose();
        });

        // # Click on the profile image
        cy.get('.profile-icon > img').as('profileIconForPopover').click();

        // # Verify that the popover is visible and contains position
        cy.contains('#user-profile-popover', position).should('be.visible');
    });

    it('MM-T2064 Position / 128 characters', () => {
        const longPosition = 'Master Hacker II'.repeat(8);

        // # Open 'Profile' modal and view the default 'Profile Settings'
        cy.uiOpenProfileModal('Profile Settings').within(() => {
            const minPositionHeader = () => cy.findByRole('heading', {name: 'Position'});
            const maxPositionInput = () => cy.findByRole('textbox', {name: 'Position'});

            // # Fill-in the position field with a value of 128 characters
            minPositionHeader().click();
            maxPositionInput().type(longPosition);
            cy.uiSave();
            maxPositionInput().should('not.exist');

            minPositionHeader().click();
            maxPositionInput().invoke('val').then((val) => {
                // * Verify that the input value is 128 characters
                expect(val.toString().length).to.equal(128);
            });

            // # Try to edit the field with maximum characters
            maxPositionInput().focus().type('random');
            maxPositionInput().invoke('val').then((val) => {
                // * Verify that the position hasn't changed
                expect(val).to.equal(longPosition);
            });

            // # Save position
            cy.uiSave();
        });
    });
});
