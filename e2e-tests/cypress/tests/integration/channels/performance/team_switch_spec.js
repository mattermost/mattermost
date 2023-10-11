// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

import {measurePerformance} from './utils.js';

describe('Team switch performance test', () => {
    let testTeam1;
    let testTeam2;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            testTeam1 = team;

            cy.apiCreateTeam('team-b', 'Team B').then(({team: team2}) => {
                testTeam2 = team2;

                // # Go to town square
                cy.visit(`/${testTeam1.name}/channels/town-square`);
                cy.get('#teamSidebarWrapper').should('be.visible');
                cy.get(`#${testTeam2.name}TeamButton`).should('be.visible');
            });
        });
    });

    it('measures switching between two teams from LHS', () => {
        // # Invoke window object
        measurePerformance(
            'teamLoad',
            1900,
            () => {
                // # Switch to Team 2
                cy.get('#teamSidebarWrapper').within(() => {
                    cy.get(`#${testTeam2.name}TeamButton`).should('be.visible').click();
                });

                // * Expect that the user has switched teams
                return expectActiveTeamToBe(testTeam2.display_name, testTeam2.name);
            },

            // # Reset test run so we can start on the initially specified team
            () => {
                cy.visit(`/${testTeam1.name}/channels/town-square`);
                cy.get('#teamSidebarWrapper').should('be.visible');
                cy.get(`#${testTeam2.name}TeamButton`).should('be.visible');
            },
        );
    });
});

const expectActiveTeamToBe = (title, url) => {
    // * Expect channel title to match title passed in argument
    cy.get('#sidebar-header-container').
        should('be.visible').
        and('contain.text', title);

    // * Expect that center channel is visible and page has loaded
    cy.get('#app-content').should('be.visible');

    // * Expect url to match url passed in argument
    return cy.url().should('contain', url);
};
