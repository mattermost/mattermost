// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @integrations

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Integrations', () => {
    let testTeam;
    let testChannel;

    before(() => {
        // # Login as test user and visit the newly created test channel
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;
            cy.visit(`/${team.name}/integrations/commands/add`);
        });
    });

    it('MM-T581 Regen token', () => {
        // # Setup slash command
        cy.get('#displayName', {timeout: TIMEOUTS.ONE_MIN}).type('Token Regen Test');
        cy.get('#description').type('test of token regeneration');
        cy.get('#trigger').type('regen');
        cy.get('#url').type('http://hidden-peak-21733.herokuapp.com/test_inchannel');
        cy.get('#autocomplete').check();
        cy.get('#saveCommand').click();

        // # Grab token 1
        let generatedToken;
        cy.get('p.word-break--all').then((number1) => {
            generatedToken = number1.text().split(' ').pop();
        });

        // # Return to channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // * Post first message and assert token1 is present in the message
        cy.postMessage('/regen testing');
        cy.uiWaitUntilMessagePostedIncludes(testChannel.id);
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).contains(generatedToken);
        });

        // # Return to slash command setup and regenerate the token
        cy.visit(`/${testTeam.name}/integrations/commands/installed`);
        cy.findByText('Regenerate Token').click();
        cy.wait(TIMEOUTS.HALF_SEC);

        // # Grab token 2
        let regeneratedToken;
        cy.get('.item-details__token > span').then((number2) => {
            regeneratedToken = number2.text().split(' ').pop();
        });

        // Return to channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // * Post second message and assert token2 is present in the message
        cy.postMessage('/regen testing 2nd message');
        cy.uiWaitUntilMessagePostedIncludes(testChannel.id);
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).contains(regeneratedToken).should('not.contain', generatedToken);
        });
    });
});
