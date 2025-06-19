// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @team_settings @smoke

import {getRandomId} from '../../../utils';

describe('Teams Suite', () => {
    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            cy.postMessage('hello');
        });
    });

    it('MM-T383 Create a new team', () => {
        // # Open team menu and click "Create a Team"
        cy.uiOpenTeamMenu('Create a team');

        // # Input team name as Team Test
        const teamName = 'Team Test';
        cy.get('#teamNameInput').should('be.visible').type(teamName);

        // # Click Next button
        cy.get('#teamNameNextButton').should('be.visible').click();

        // # Input team URL as variable teamURl
        const teamURL = `team-${getRandomId()}`;
        cy.get('#teamURLInput').should('be.visible').type(teamURL);

        // # Click finish button
        cy.get('#teamURLFinishButton').should('be.visible').click();

        // * Should redirect to Town Square channel
        cy.get('#channelHeaderTitle').should('contain', 'Town Square');

        // * check url is correct
        cy.url().should('include', teamURL + '/channels/town-square');

        // * Team name should displays correctly at top of LHS
        cy.uiGetLHSHeader().findByText(teamName);
    });

    it('MM-T1437 Try to create a new team using restricted words', () => {
        // * Enter different reserved words and verify the error message
        [
            'plugins',
            'login',
            'admin',
            'channel',
            'post',
            'api',
            'oauth',
            'error',
            'help',
        ].forEach((reservedTeamPath) => {
            tryReservedTeamURLAndVerifyError(reservedTeamPath);
        });
    });
});

function tryReservedTeamURLAndVerifyError(teamURL) {
    // # Open team menu and click "Create a Team"
    cy.uiOpenTeamMenu('Create a team');

    // # Input passed in team name
    cy.get('#teamNameInput').should('be.visible').type(teamURL);

    // # Click Next button
    cy.findByText('Next').should('be.visible').click();

    // # Input a passed in value of the team url
    cy.get('#teamURLInput').should('be.visible').clear().type(teamURL);

    // # Hit finish button
    cy.findByText('Finish').should('exist').click();

    // * Verify that we get error message for reserved team url
    cy.get('form').within(() => {
        // # Split search into multiple lines as text contains links and new lines
        cy.findByText(/This URL\s/).should('exist');
        cy.findByText(/starts with a reserved word/).should('exist');
        cy.findByText(/\sor is unavailable. Please try another./).should('exist');
    });

    // # Close the modal
    cy.findByText('Back').click();
}
