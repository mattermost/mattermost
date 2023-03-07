// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @notifications

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Notifications', () => {
    let testUser;
    let testTeam;
    let otherTeam;
    let testTeamTownSquareUrl;
    let siteName;

    before(() => {
        cy.apiGetConfig().then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });

        cy.apiCreateTeam('team-b', 'Team B').then(({team}) => {
            otherTeam = team;
        });

        cy.apiInitSetup().then(({team, user, townSquareUrl}) => {
            testTeam = team;
            testUser = user;
            testTeamTownSquareUrl = townSquareUrl;

            cy.apiAddUserToTeam(otherTeam.id, testUser.id);

            cy.apiCreateUser().then(({user: otherUser}) => {
                cy.apiAddUserToTeam(team.id, otherUser.id);
            });

            // # Remove mention notification (for initial channel).
            cy.apiLogin(testUser);
            cy.visit(testTeamTownSquareUrl);
            cy.postMessage('hello');
            cy.get('#sidebar-left').get('.unread-title').click();

            // * Wait for some time, then verify that the badge is removed before logging out.
            cy.wait(TIMEOUTS.ONE_SEC);
            cy.get('.badge').should('not.exist');
            cy.apiLogout();
        });
    });

    it('MM-T556 Browser tab and team sidebar notification - no unreads/mentions', () => {
        // # Test user views test team
        cy.apiLogin(testUser);
        cy.visit(testTeamTownSquareUrl);

        cy.title().should('include', `Town Square - ${testTeam.display_name} ${siteName}`);

        // * Browser tab shows channel name with no unread indicator
        cy.get(`#${testTeam.name}TeamButton`).parent('.unread').should('not.exist');
        cy.get('.badge').should('not.exist');

        // * No unread/mention indicator in other team's sidebar
        cy.get(`#${otherTeam.name}TeamButton`).parent('.unread').should('not.exist');
        cy.get('.badge').should('not.exist');
    });
});
