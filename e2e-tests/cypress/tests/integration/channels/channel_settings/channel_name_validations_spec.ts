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
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let testChannel: Cypress.Channel;

    before(() => {
        cy.apiInitSetup().then(({team, user, channel}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;

            // # Login as test user and go to town square
            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T884_1 Renaming channel name validates against two user IDs being used in URL', () => {
        // # Create new test channel
        cy.uiCreateChannel({name: 'Test__Channel'});

        // # Click on channel menu and press rename channel
        cy.get('#channelHeaderDropdownIcon').click();
        cy.findByText('Rename Channel').click();

        // # Assert if the rename modal present
        cy.get('[aria-labelledby="renameChannelModalLabel"').should('be.visible').within(() => {
            // # type the two 26 character strings with 2 underscores between them and click on save
            cy.get('#channel_name').clear().type('uzsfmtmniifsjgesce4u7yznyh__uzsfmtmniifsjgesce5u7yznyh', {force: true}).wait(TIMEOUTS.HALF_SEC);
            cy.get('#save-button').should('be.visible').click();

            // # Assert the error occurred with the appropriate message
            cy.get('.input__help').should('have.class', 'error');
            cy.get('.input__help').should('have.text', 'User IDs are not allowed in channel URLs.');
            cy.findByText('Cancel').click();
        });
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

        // # In a test channel, click the "v" to the right of the channel name in the header
        cy.findByText(`${testChannel.display_name}`).click();
        cy.get('#channelHeaderDropdownIcon').click();

        // # Select "Rename Channel"
        cy.findByText('Rename Channel').click();

        // # Change the channel name to {26 alphanumeric characters}[insert 2 spaces]{26 alphanumeric characters}
        //   i.e. a total of 54 characters separated by 2 spaces
        cy.get('#display_name').clear().type(`${firstWord}${Cypress._.repeat(' ', 2)}${secondWord}`);

        // # Hit Save
        cy.findByText('Save').click();

        // * The channel name should be updated to the characters you typed with only 1 space between the characters (extra spaces are trimmed)
        cy.get('#channelHeaderTitle').contains(`${firstWord} ${secondWord}`);

        // # In a test channel, click the "v" to the right of the channel name in the header
        cy.get('#channelHeaderDropdownIcon').click();

        // # Select "Rename Channel"
        cy.findByText('Rename Channel').click();

        // # Change the URL to {26 alphanumeric characters}--{26 alphanumeric characters}
        cy.get('#channel_name').clear().type(`${firstWord}${Cypress._.repeat('-', 2)}${secondWord}`);

        // # Hit Save
        cy.findByText('Save').click();

        // * The channel URL should be updated to the characters you typed, separated by 2 dashes
        cy.url().should('equal', `${Cypress.config('baseUrl')}/${testTeam.name}/channels/${firstWord}${Cypress._.repeat('-', 2)}${secondWord}`);
    });
});
