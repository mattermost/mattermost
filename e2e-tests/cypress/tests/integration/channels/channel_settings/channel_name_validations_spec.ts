// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @channel_settings

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getRandomId} from '../../../utils';

describe('Channel routing', () => {
    let testTeam: any;
    let testUser: any;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as test user and go to town square
            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T884_1 Renaming channel name validates against two user IDs being used in URL', () => {
        // # Create new test channel
        cy.uiCreateChannel({name: 'Test__Channel'});

        // # Open channel settings modal from channel header dropdown
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // # Assert if the channel settings modal is present
        cy.get('.ChannelSettingsModal').should('be.visible');

        // # Click on the URL input button to edit the URL
        cy.get('.url-input-button').should('be.visible').click({force: true});

        // # Type the two 26 character strings with 2 underscores between them
        cy.get('.url-input-container input').clear().type('uzsfmtmniifsjgesce4u7yznyh__uzsfmtmniifsjgesce5u7yznyh', {force: true}).wait(TIMEOUTS.HALF_SEC);

        // # Assert the error occurred with the appropriate message
        cy.get('.SaveChangesPanel').should('contain', 'There are errors in the form above');
        cy.get('.url-input-error').should('contain', 'User IDs are not allowed in channel URLs.');

        // # Close the modal
        cy.get('.GenericModal .modal-header button[aria-label="Close"]').click();
    });

    it('MM-T884_2 Creating new channel validates against two user IDs being used as channel name', () => {
        // # click on create public channel
        cy.uiBrowseOrCreateChannel('Create new channel');

        // * Verify that the new channel modal is visible
        cy.get('#new-channel-modal').should('be.visible').within(() => {
            // # Add the new channel name with invalid name and press Create Channel
            cy.get('#input_new-channel-modal-name').type('uzsfmtmniifsjgesce4u7yznyh__uzsfmtmniifsjgesce5u7yznyh', {force: true}).wait(TIMEOUTS.HALF_SEC);
            cy.findByText('Create channel').should('be.visible').click();

            // * Assert the error occurred with the appropriate message
            cy.get('.genericModalError').should('be.visible').within(() => {
                cy.findByText('Channel names can\'t be in a hexadecimal format. Please enter a different channel name.');
            });

            // # Close the create channel modal
            cy.uiCancelButton().click();
        });
    });

    it('MM-T884_3 Creating a new channel validates against gm-like names being used as channel name', () => {
        // # click on create public channel
        cy.uiBrowseOrCreateChannel('Create new channel');

        // * Verify that the new channel modal is visible
        cy.findByRole('dialog', {name: 'Create a new channel'}).within(() => {
            // # Add the new channel name with invalid name and press Create Channel
            cy.findByPlaceholderText('Enter a name for your new channel').type('71b03afcbb2d503d49f87f057549c43db4e19f92', {force: true}).wait(TIMEOUTS.HALF_SEC);
            cy.uiGetButton('Create channel').click();

            // * Assert the error occurred with the appropriate message
            cy.get('.genericModalError').should('be.visible').within(() => {
                cy.findByText('Channel names can\'t be in a hexadecimal format. Please enter a different channel name.');
            });

            // # Close the create channel modal
            cy.uiCancelButton().click();
        });
    });

    it('MM-T883 Channel URL validation for spaces between characters', () => {
        const firstWord = getRandomId(26);
        const secondWord = getRandomId(26);
        const channelName = 'test-channel-' + getRandomId(8);

        // # Create a new test channel and navigate to it
        cy.apiCreateChannel(testTeam.id, channelName, 'Test Channel for URL Validation').then(({channel}) => {
            cy.apiAddUserToChannel(channel.id, testUser.id);
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
        });

        // # Open channel settings modal from channel header dropdown
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();

        // # Change the channel name to {26 alphanumeric characters}[insert 2 spaces]{26 alphanumeric characters}
        //   i.e. a total of 54 characters separated by 2 spaces
        cy.get('#input_channel-settings-name').clear().type(`${firstWord}${Cypress._.repeat(' ', 2)}${secondWord}`);

        // # Save changes
        cy.get('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Verify changes are saved
        cy.get('.SaveChangesPanel').should('contain', 'Settings saved');

        // # Close the modal
        cy.get('.GenericModal .modal-header button[aria-label="Close"]').click();

        // * The channel name should be updated to the characters you typed with only 1 space between the characters (extra spaces are trimmed)
        cy.get('#channelHeaderTitle').contains(`${firstWord} ${secondWord}`);

        // * The channel URL should be updated to the characters you typed, separated by 2 dashes
        cy.url().should('equal', `${Cypress.config('baseUrl')}/${testTeam.name}/channels/${firstWord}${Cypress._.repeat('-', 2)}${secondWord}`);
    });
});
