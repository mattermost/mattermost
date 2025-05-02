// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @channel_settings

import {Team} from '@mattermost/types/teams';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

describe('Channel Settings Modal', () => {
    let testTeam: Team;
    let testUser: UserProfile;
    let testChannel: Channel;
    let originalTestChannel: Channel;

    before(() => {
        // Setup test data
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create a test channel
            cy.apiCreateChannel(testTeam.id, 'test-channel', 'Test Channel').then(({channel}) => {
                testChannel = channel;
                originalTestChannel = {...channel};
                cy.apiAddUserToChannel(channel.id, user.id);
            });

            cy.apiLogin(testUser);
        });
    });

    beforeEach(() => {
        // Visit the channel before each test
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    // 2DO: update tests ids once QA has defined the test plan and zephyr tests
    it('MM-T1: Can open and close the channel settings modal', () => {
        // # Open channel settings modal from channel header dropdown
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // * Verify modal is open
        cy.get('.ChannelSettingsModal').should('be.visible');
        cy.get('#genericModalLabel').should('contain', 'Channel Settings');

        // # Close the modal
        cy.get('.GenericModal .modal-header button[aria-label="Close"]').click();

        // * Verify modal is closed
        cy.get('.ChannelSettingsModal').should('not.exist');
    });

    it('MM-T2: Can navigate between tabs', () => {
        // # Open channel settings modal
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // * Verify Info tab is active by default
        cy.get('#infoButton').should('have.class', 'active');
        cy.get('.ChannelSettingsModal__infoTab').should('be.visible');

        // # Click on Archive tab
        cy.get('#archiveButton').click();

        // * Verify Archive tab is active
        cy.get('#archiveButton').should('have.class', 'active');
        cy.get('.ChannelSettingsModal__archiveTab').should('be.visible');

        // # Click back on Info tab
        cy.get('#infoButton').click();

        // * Verify Info tab is active again
        cy.get('#infoButton').should('have.class', 'active');
        cy.get('.ChannelSettingsModal__infoTab').should('be.visible');
    });

    it('MM-T3: Can edit channel name and URL', () => {
        // # Open channel settings modal
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // # Get original channel name, url and alias it
        cy.get('#input_channel-settings-name').invoke('val').as('originalName');
        cy.get('.url-input-label').invoke('val').as('originalUrl');

        // # Edit channel name
        cy.get('#input_channel-settings-name').clear().type('Updated Channel Name');

        // * Verify URL is updated automatically
        cy.get('.url-input-label').should('contain', 'updated-channel-name');

        // # Click Save
        cy.get('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Verify changes are saved
        cy.get('.SaveChangesPanel').should('contain', 'Settings saved');

        // # Close the modal
        cy.get('.GenericModal .modal-header button[aria-label="Close"]').click();

        // * Verify channel header shows updated name
        cy.get('#channelHeaderTitle').should('contain', 'Updated Channel Name');

        // # Open channel settings modal to restore original values
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // * Verify the channel name is reset to the original value
        cy.get('#input_channel-settings-name').clear().type(originalTestChannel.display_name);

        // # Try to change URL to match the original url
        cy.get('.url-input-button').click();
        cy.get('.url-input-container input').clear().type(originalTestChannel.name);
        cy.get('.url-input-container button.url-input-button').click();

        // # Save changes
        cy.get('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Verify changes are saved
        cy.get('.SaveChangesPanel').should('contain', 'Settings saved');

        // # Close the modal
        cy.get('.GenericModal .modal-header button[aria-label="Close"]').click();

        // * Verify channel header shows updated name
        cy.get('#channelHeaderTitle').should('contain', originalTestChannel.display_name);
    });

    it('MM-T4: Shows error for invalid channel name', () => {
        // # Open channel settings modal
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // # Set empty channel name
        cy.get('#input_channel-settings-name').clear();

        // # Try Save changes
        cy.get('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Verify error is shown
        cy.get('.Input_fieldset').should('have.class', 'Input_fieldset___error');
        cy.get('.SaveChangesPanel').should('contain', 'There are errors in the form above');
    });

    it('MM-T6: Can edit channel purpose and header', () => {
        // # Open channel settings modal
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // # Edit channel purpose
        cy.get('#channel_settings_purpose_textbox').clear().type('This is a test purpose');

        // # Edit channel header
        cy.get('#channel_settings_header_textbox').clear().type('This is a test header');

        // # Save changes
        cy.get('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Verify changes are saved
        cy.get('.SaveChangesPanel').should('contain', 'Settings saved');

        // # Close the modal
        cy.get('.GenericModal .modal-header button[aria-label="Close"]').click();

        // * Verify channel header shows updated header
        cy.get('#channelHeaderDescription').should('contain', 'This is a test header');
    });

    it('MM-T7: Shows error when purpose exceeds character limit', () => {
        // # Open channel settings modal
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // # Enter purpose that exceeds character limit (250 characters)
        const longPurpose = 'a'.repeat(260);
        cy.get('#channel_settings_purpose_textbox').clear().type(longPurpose);

        // * Verify error is shown
        cy.findAllByTestId('channel_settings_purpose_textbox').should('have.class', 'textarea--has-errors');
        cy.get('.SaveChangesPanel').should('contain', 'There are errors in the form above');
    });

    it('MM-T8: Shows error when header exceeds character limit', () => {
        // # Open channel settings modal
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // # Enter header that exceeds character limit (1024 characters)
        const longHeader = 'a'.repeat(1050);
        cy.findByTestId('channel_settings_header_textbox').clear().type(longHeader);

        // * Verify error is shown
        cy.findByTestId('channel_settings_header_textbox').should('have.class', 'textarea--has-errors');
        cy.get('.SaveChangesPanel').should('contain', 'There are errors in the form above');
    });

    it('MM-T9: Can archive a channel and redirect to previous visited channel', () => {
        // # Create a new channel for this test
        cy.apiCreateChannel(testTeam.id, 'first-channel', 'First Channel').then(({channel: channel1}) => {
            cy.apiCreateChannel(testTeam.id, 'second-channel', 'Second Channel').then(({channel}) => {
            // # visit town square
                cy.visit(`/${testTeam.name}/channels/${channel1.name}`);

                // # visit just created channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Open channel settings modal
                cy.get('#channelHeaderDropdownButton').click();
                cy.findByText('Channel Settings').click();

                // # Click on Archive tab
                cy.get('#archiveButton').click();

                // # Click Archive button
                cy.get('#channelSettingsArchiveChannelButton').click();

                // * Verify confirmation modal appears
                cy.get('#archiveChannelConfirmModal').should('be.visible');

                // # Confirm archive
                cy.findByRole('button', {name: 'Confirm'}).click();

                // * Verify redirect to Town Square
                cy.url().should('include', channel1.name);

                // * Verify channel is no longer in sidebar
                cy.get('.SidebarChannel').contains('Archive Test').should('not.exist');
            });
        });
    });

    it('MM-T10: Warns when switching tabs with unsaved changes', () => {
        // # Create a new channel for this test
        cy.apiCreateChannel(testTeam.id, 'unsaved-test', 'Unsaved Test').then(({channel}) => {
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Open channel settings modal
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Channel Settings').click();

            // # Make a change to the channel name
            cy.get('#input_channel-settings-name').clear().type('Changed Name');

            // # Try to switch to Archive tab
            cy.get('#archiveButton').click();

            // * Verify we're still on the Info tab due to unsaved changes
            cy.get('#infoButton').should('have.class', 'active');

            // * Verify save changes panel shows error
            cy.get('.SaveChangesPanel').should('have.class', 'error');
        });
    });

    // MM-T11: Can reset changes without saving
    it('MM-T11: Can reset changes without saving', () => {
    // # Create a new channel for this test
        cy.apiCreateChannel(testTeam.id, 'reset-test', 'Reset Test').then(({channel}) => {
        // # Visit the channel page using the channel name returned from the API
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Open channel settings modal
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Channel Settings').click();

            // # Get original channel name and alias it
            cy.get('#input_channel-settings-name').invoke('val').as('originalName');

            // # Change the channel name
            cy.get('#input_channel-settings-name').clear().type('Temporary Name');

            // # Click the Reset button in the SaveChangesPanel
            cy.get('.SaveChangesPanel button').contains('Reset').click();

            // * Verify the channel name is reset to the original value
            cy.get('@originalName').then((originalName) => {
                cy.get('#input_channel-settings-name').should('have.value', originalName);
            });

            // * Verify the SaveChangesPanel is no longer visible
            cy.get('.SaveChangesPanel').should('not.exist');
        });
    });

    // MM-T12: Can preview purpose and header with markdown
    it('MM-T12: Can preview purpose and header with markdown', () => {
    // # Create a new channel for this test
        cy.apiCreateChannel(testTeam.id, 'markdown-test', 'Markdown Test').then(({channel}) => {
        // # Visit the channel page using the channel name returned from the API
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Open channel settings modal
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Channel Settings').click();

            // # Add markdown to purpose
            cy.get('#channel_settings_purpose_textbox').clear().type('This is **bold** and _italic_ text');

            // # Click preview button for purpose (assumes preview button is inside the AdvancedTextbox container)
            cy.get('#channel_settings_purpose_textbox').
                parents('.AdvancedTextbox').
                find('#PreviewInputTextButton').
                click();

            // * Verify that markdown is rendered in preview: check for bold and italic formatting
            cy.get('.textbox-preview-area').
                should('contain', 'This is').
                find('strong').
                should('contain', 'bold');
            cy.get('.textbox-preview-area').
                find('em').
                should('contain', 'italic');

            // # Add markdown to header
            cy.get('#channel_settings_header_textbox').clear().type('Visit [Mattermost](https://mattermost.com)');

            // # Click preview button for header
            cy.get('#channel_settings_header_textbox').
                parents('.AdvancedTextbox').
                find('#PreviewInputTextButton').
                click();

            // * Verify that markdown is rendered in preview: check for a link with text "Mattermost"
            cy.get('.textbox-preview-area').
                should('contain', 'Visit').
                find('a').
                should('contain', 'Mattermost');
        });
    });

    it('MM-T13: Validates URL when editing channel name', () => {
        // # Create two channels to test URL conflict error
        cy.apiCreateChannel(testTeam.id, 'first-channel', 'First Channel').then(({channel: channel1}) => {
            cy.apiCreateChannel(testTeam.id, 'second-channel', 'Second Channel').then(({channel}) => {
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Open channel settings modal
                cy.get('#channelHeaderDropdownButton').click();
                cy.findByText('Channel Settings').click();

                // # Try to change URL to match the first channel
                cy.get('.url-input-button').click();
                cy.get('.url-input-container input').clear().type(channel1.name);
                cy.get('.url-input-container button.url-input-button').click();

                // * Verify error is shown
                cy.get('[data-testid="SaveChangesPanel__save-btn"]').click();
                cy.get('.SaveChangesPanel').should('contain', 'There are errors in the form above');
            });
        });
    });
});
