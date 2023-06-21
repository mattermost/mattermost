// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import {verifyDraftIcon} from './helpers';

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Message Draft With empty Post and File Attachments', () => {
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

    it('MM-49228_1 Not storing draft if it only contains whitespace', () => {
        const {name, display_name: displayName} = testChannel;

        // * Validate if the draft icon is not visible at LHS before making a draft
        verifyDraftIcon(name, false);

        // # Go to test channel and check if it opened correctly
        openChannelFromLhs(testTeam.name, displayName, name);

        // # Type an empty message in the input box but do not send
        cy.findByRole('textbox', `write to ${displayName.toLowerCase()}`).should('be.visible').type('        ');

        // # Switch to another channel and check if it opened correctly
        openChannelFromLhs(testTeam.name, 'Town Square', 'town-square');

        // * Draft icon should not be in the LHS as it was an empty post
        verifyDraftIcon(name, false);
    });

    it('MM-49228_2 should store draft if a file is attached', () => {
        cy.reload();
        const {name, display_name: displayName} = testChannel;

        openChannelFromLhs(testTeam.name, displayName, name);

        // Upload an icon
        cy.get('#fileUploadInput').attachFile('mattermost-icon.png');

        // post a message with the attached file
        cy.findByRole('textbox', `write to ${displayName.toLowerCase()}`).should('be.visible').type('i am a dummy message');

        //switch to a different channel
        cy.visit(`/${testTeam.name}/channels/off-topic`);
        cy.wait(TIMEOUTS.FOUR_SEC);

        // * Drafts should exist in the sidebar as the message with the post was not empty
        cy.findByText('Drafts').should('be.visible');

        //go to drafts
        cy.visit(`/${testTeam.name}/drafts`);

        // draft should exist with the message and file attached
        cy.findByText('i am a dummy message').should('exist');
        cy.findByText('mattermost-icon.png').should('exist');
    });
});

function openChannelFromLhs(teamName, channelName, name) {
    // # Go to test channel and check if it opened correctly
    cy.uiGetLhsSection('CHANNELS').findByText(channelName).click();
    cy.url().should('include', `/${teamName}/channels/${name}`);
}
