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

            // # Select the "Edit Channel Header" option from the dropdown
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Channel Settings').click();

            // * Verify modal is open
            cy.get('.ChannelSettingsModal').should('be.visible');
            cy.get('#genericModalLabel').should('contain', 'Channel Settings');

            // # Type something in the header edit box
            cy.get('#channel_settings_header_textbox').clear().type('This is the new header content');

            // * Verify the "Preview" button exists and is not active
            cy.get('#channel_settings_header_textbox').
                parents('.AdvancedTextbox').
                find('#PreviewInputTextButton').
                should('not.have.class', 'active');

            // * Verify that before hitting the preview button, the style on the textbox is `display: block`
            cy.get('#channel_settings_header_textbox').should('have.css', 'display', 'block');

            // # Click the "Preview" button
            cy.get('#channel_settings_header_textbox').
                parents('.AdvancedTextbox').
                find('#PreviewInputTextButton').click();

            // * Verify that the display is now none on the textbox element
            cy.get('#channel_settings_header_textbox').should('have.css', 'display', 'none');

            // * Verify the "Preview" button has class active
            cy.get('#channel_settings_header_textbox').
                parents('.AdvancedTextbox').
                find('#PreviewInputTextButton').
                should('have.class', 'active');
        });
    });
});
