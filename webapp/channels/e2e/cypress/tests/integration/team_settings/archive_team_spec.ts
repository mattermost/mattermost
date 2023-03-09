// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @team_settings

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Teams Settings', () => {
    let sysadmin: Cypress.UserProfile;

    before(() => {
        cy.apiCreateCustomAdmin({loginAfter: true}).then(({sysadmin: admin}) => {
            sysadmin = admin;
        });
    });

    it('MM-T5299 User tries to go to archived team', () => {
        // # Create a new user
        cy.apiCreateUser().then(({user}) => {
            // # Create a new team 1
            cy.apiCreateTeam('team1', 'team1').then(({team: team1}) => {
                // # Create a new team 2
                cy.apiCreateTeam('team2', 'team2').then(({team: team2}) => {
                    // # Add user to both teams
                    cy.apiAddUserToTeam(team1.id, user.id);
                    cy.apiAddUserToTeam(team2.id, user.id);

                    cy.apiLogin(user);

                    // # Visit team 1 so the previous team is set to team 1 in local storage
                    cy.visit(`/${team1.name}/channels/town-square`);

                    // * Verify user is part of both teams
                    cy.get(`#${team1.name}TeamButton`, {timeout: TIMEOUTS.TEN_SEC}).should('be.visible');
                    cy.get(`#${team2.name}TeamButton`, {timeout: TIMEOUTS.TEN_SEC}).should('be.visible');

                    // # Logout the user
                    cy.apiLogout();
                    cy.clearLocalStorage();
                    cy.reload();

                    // # Login as admin
                    cy.apiLogin(sysadmin);

                    // # Archive team 1
                    cy.apiDeleteTeam(team1.id);

                    // # Logout the admin
                    cy.apiLogout();

                    // # Login as user
                    cy.apiLogin(user);
                    cy.visit('/');

                    // * Verify we landed on team 2 url
                    cy.url().should('include', `/${team2.name}/channels/town-square`);

                    // # Try to visit team 1 from the url
                    cy.visit(`/${team1.name}/channels/town-square`);

                    // * Verify we are redirected to team not found
                    cy.url().should('include', '/error?type=team_not_found');
                });
            });
        });
    });
});
