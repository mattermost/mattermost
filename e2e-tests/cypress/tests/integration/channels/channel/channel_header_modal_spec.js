// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @channel_settings

describe('Channel Settings - Channel Header', () => {
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            cy.apiLogin(user);

            // # Visit town-square channel
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('Create channel, modify header, and verify preview button functionality', () => {
        // # Create a new channel
        cy.apiCreateChannel(testTeam.id, 'new-channel', 'New Channel').then(({channel}) => {
            // # Visit the newly created channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Click on the channel name in the channel header to open the channel menu options
            cy.get(`[aria-label="${channel.name.split('-').join(' ')} channel menu"]`).click();

            // # Select the "Edit Channel Header" option from the dropdown
            cy.findByText('Edit Channel Header').click();

            // # Type something in the header edit box
            cy.get('textarea[placeholder="Edit the Channel Header..."]').clear().type('This is the new header content');

            // * Verify the "Preview" button exists
            cy.findByText('Preview').should('be.visible');

            // * Verify that before hitting the preview button, the style on the textbox is `display: block`
            cy.get('textarea[placeholder="Edit the Channel Header..."]').should('have.css', 'display', 'block');

            // # Click the "Preview" button
            cy.findByText('Preview').click();

            // * Verify the "Preview" button label has changed to "Edit"
            cy.findByText('Edit').should('be.visible');

            // * Verify that the display is now none on the textbox element
            cy.get('textarea[placeholder="Edit the Channel Header..."]').should('have.css', 'display', 'none');
        });
    });
});
