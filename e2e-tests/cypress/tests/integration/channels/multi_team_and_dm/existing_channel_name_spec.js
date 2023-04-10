// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @multi_team_and_dm

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Channel', () => {
    let testTeamId;

    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            testTeamId = team.id;
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T422_1 Channel name already taken for public channel', () => {
        // # Create a new public channel
        createNewChannel('unique-public', false, testTeamId).as('channel');
        cy.reload();

        cy.get('@channel').then((channel) => {
            // * Verify new public channel cannot be created with existing public channel name
            verifyChannel(channel);
        });
    });

    it('MM-T422_2 Channel name already taken for private channel', () => {
        // # Create a new private channel
        createNewChannel('unique-private', true, testTeamId).as('channel');
        cy.reload();

        cy.get('@channel').then((channel) => {
            // * Verify new private channel cannot be created with existing private channel name
            verifyChannel(channel);
        });
    });

    it('MM-43881 Channel name already taken for public channel and changed allows to create', () => {
        // # Create a new public channel
        createNewChannel('other-public', false, testTeamId).as('channel');
        cy.reload();

        cy.get('@channel').then((channel) => {
            // * Verify new public channel cannot be created with existing public channel name
            verifyExistingChannelError(channel.name);

            // Update channel name in the input field for new channel
            cy.get('#input_new-channel-modal-name').should('be.visible').click().type(`${channel.name}1`);
            cy.wait(TIMEOUTS.HALF_SEC);

            // * Error message saying "A channel with that name already exists" should be removed
            cy.get('.url-input-error').should('not.exist');

            // * 'Create Channel' button should be enabled
            cy.findByText('Create channel').should('not.have.class', 'disabled');

            // # Click on Cancel button to move out of New Channel Modal
            cy.findByText('Cancel').click();
        });
    });
});

/**
* Creates a channel with existing name and verify that error is shown
* @param {String} newChannelName - New channel name to assign
* @param {boolean} makePrivate - Set to false to make public channel (default), otherwise true as private channel
*/
function verifyExistingChannelError(newChannelName, makePrivate = false) {
    // Click on '+' button for Public or Private Channel
    cy.uiBrowseOrCreateChannel('Create new channel').click();

    if (makePrivate) {
        cy.get('#public-private-selector-button-P').click();
    } else {
        cy.get('#public-private-selector-button-O').click();
    }

    // Type `newChannelName` in the input field for new channel
    cy.get('#input_new-channel-modal-name').should('be.visible').click().type(`${newChannelName}{enter}`);

    // * User gets a message saying "A channel with that name already exists"
    cy.get('.url-input-error').contains('A channel with that URL already exists');

    // * 'Create Channel' button should be disabled
    cy.findByText('Create channel').should('have.class', 'disabled');
}

/**
* Attempts to create public and private channels with existing `channelName` and verifies error
* @param {String} channelName - Existing channel name that is also being tested for error
*/
function verifyChannel(channel) {
    // # Find current number of channels
    cy.uiGetLhsSection('CHANNELS').find('.SidebarChannel').its('length').as('origChannelLength');

    // * Verify channel `channelName` exists
    cy.uiGetLhsSection('CHANNELS').should('contain', channel.display_name);

    // * Verify new public channel cannot be created with existing public channel name
    verifyExistingChannelError(channel.name);

    // # Click on Cancel button to move out of New Channel Modal
    cy.findByText('Cancel').click();

    // * Verify new private channel cannot be created with existing public channel name
    verifyExistingChannelError(channel.name, true);

    // # Click on Cancel button to move out of New Channel Modal
    cy.findByText('Cancel').click();

    // * Verify the number of channels is still the same as before
    cy.get('@origChannelLength').then((origChannelLength) => {
        cy.uiGetLhsSection('CHANNELS').find('.SidebarChannel').its('length').should('equal', origChannelLength);
    });
}

/**
 * Create new channel via API
 * @param {String} name Name of the channel. This will be used for both name and display_name
 * @param {Boolean} isPrivate Should the channel be private
 * @param {String} testTeamId Team where to create a channel
 * @returns body of request
 */
function createNewChannel(name, isPrivate = false, testTeamId) {
    const makePrivate = isPrivate ? 'P' : 'O';

    return cy.apiCreateChannel(testTeamId, name, name, makePrivate, 'Let us chat here').its('channel');
}
