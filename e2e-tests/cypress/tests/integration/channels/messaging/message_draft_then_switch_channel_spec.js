// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @messaging

import {verifyDraftIcon} from './helpers';

describe('Message Draft and Switch Channels', () => {
    let testTeam;
    let testChannel;

    before(() => {
        // # Create new team and new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;
            cy.visit(`/${testTeam.name}/channels/off-topic`);
        });
    });

    it('MM-T131 Message Draft Pencil Icon - CTRL/CMD+K & "Jump to"', () => {
        const {name, display_name: displayName, id} = testChannel;
        const message = 'message draft test';

        // * Validate if the draft icon is not visible at LHS before making a draft
        verifyDraftIcon(name, false);

        // # Go to test channel and check if it opened correctly
        openChannelFromLhs(testTeam.name, displayName, name);

        // # Type a message in the input box but do not send
        cy.findByRole('textbox', `write to ${displayName.toLowerCase()}`).should('be.visible').type(message);

        // # Switch to another channel and check if it opened correctly
        openChannelFromLhs(testTeam.name, 'Off-Topic', 'off-topic');

        // * Validate if the draft icon is visible at LHS
        verifyDraftIcon(name, true);

        // # Press CTRL/CMD+K shortcut to open Quick Channel Switch modal
        cy.typeCmdOrCtrl().type('K', {release: true});

        // * Verify that the switch model is shown
        cy.findAllByRole('dialog').first().findByText('Find Channels').should('be.visible');

        // # Type the first few letters of the channel name you typed the message draft in
        cy.findByRole('textbox', {name: 'quick switch input'}).type(displayName.substring(0, 3));

        // * Suggestion list is visible
        cy.get('#suggestionList').should('be.visible').within(() => {
            // * A pencil icon before the channel name in the filtered list is visible
            cy.get(`#switchChannel_${id}`).find('.icon-pencil-outline').should('be.visible');

            // # Click to switch back to the test channel
            cy.get(`#switchChannel_${id}`).click({force: true});
        });

        // * Draft is saved in the text input box of the test channel
        cy.findByRole('textbox', `write to ${displayName.toLowerCase()}`).should('be.visible').and('have.text', message);
    });
});

function openChannelFromLhs(teamName, channelName, name) {
    // # Go to test channel and check if it opened correctly
    cy.uiGetLhsSection('CHANNELS').findByText(channelName).click();
    cy.url().should('include', `/${teamName}/channels/${name}`);
}
