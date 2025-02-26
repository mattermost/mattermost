// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications

describe('Notifications', () => {
    before(() => {
        cy.apiInitSetup().then(({team, user, channel}) => {
            // # Login as user and visit channel
            cy.apiLogin(user);
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T5458 Notification sound modal selection should reset when settings canceled', () => {
        // # Open 'Settings' modal
        cy.uiOpenSettingsModal();

        // # Navigate to Desktop Notification Settings
        cy.get('#desktopNotificationSoundEdit').should('be.visible').click();

        // # Change Notification selection
        cy.get('#messageNotificationSoundSelect').click();

        // # Select 'Bing' sound
        cy.findByText('Down').click();

        // # Click Cancel button to close the settings
        cy.uiCancelButton().click();

        // # Click on the 'Edit' button next to Desktop sound notification again
        cy.get('#desktopNotificationSoundEdit').should('be.visible').click();

        // * Verify that the Notification sound is set to Bing as we canceled the settings
        cy.findByText('Bing').should('be.visible');

        cy.uiClose();
    });
});
