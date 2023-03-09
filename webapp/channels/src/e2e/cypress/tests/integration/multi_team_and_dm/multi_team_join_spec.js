// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @multi_team_and_dm

import {DEFAULT_TEAM} from '../../support/constants';

const NUMBER_OF_TEAMS = 3;

describe('Multi-Team + DMs', () => {
    before(() => {
        // # Create an account
        cy.apiCreateUser().its('user').as('user');

        // # Delete all existing teams to clean-up
        cy.apiGetAllTeams().then(({teams}) => {
            teams.forEach((team) => {
                if (team.name !== DEFAULT_TEAM.name) {
                    cy.apiDeleteTeam(team.id, true);
                }
            });
        });

        // # Create teams for user to join
        for (let i = 0; i < NUMBER_OF_TEAMS; i++) {
            cy.apiCreateTeam('team', 'Team', 'O', true, {allow_open_invite: true});
        }
    });

    it('MM-T1805 No infinite loading spinner on Select Team page', function() {
        // # Log-in with created user
        cy.apiLogin(this.user);

        // # Join all available teams and go to {servername}/select_team
        joinAllTeams();

        // * Check that no infinite loading spinner is shown
        cy.get('.loading-screen').should('not.exist');
    });
});

function joinAllTeams() {
    cy.visit('/select_team');
    cy.findByText('All team communication in one place, searchable and accessible anywhere');
    cy.findAllByText(/Team\s/).then(([firstTeam, nextTeam]) => {
        firstTeam.click();

        if (nextTeam) {
            joinAllTeams();
        }
    });
}
