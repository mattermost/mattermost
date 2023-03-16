// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @multi_team_and_dm

import {getRandomId} from '../../../utils';

describe('Multi Team and DM', () => {
    let testChannel;
    let testTeam;
    let testUser;

    const unique = `${getRandomId(4)}`;

    before(() => {
        // # Setup with the new team, channel and user
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            // # Create 4 test users with prefix 'common'
            Cypress._.times(4, () => {
                cy.apiCreateUser({prefix: 'common'}).then(() => {
                    cy.apiAddUserToTeam(testTeam.id, user.id);
                });
            });

            // # Create 2 test users with random prefix
            Cypress._.times(2, () => {
                cy.apiCreateUser({prefix: unique}).then(() => {
                    cy.apiAddUserToTeam(testTeam.id, user.id);
                });
            });

            // # Login with testUser and visit test channel
            cy.apiLogin(testUser);
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        });
    });

    it('MM-T444 DM More... show user count', () => {
        // # Open the Direct Message modal
        cy.uiAddDirectMessage().click();

        cy.get('#multiSelectHelpMemberInfo > :nth-child(2)').then((number) => {
            // # Grab total number of users before filter applied
            const totalUsers = number.text().split(' ').slice(2, 3);

            // * Assert that 2 unique users are displayed
            cy.findByRole('textbox', {name: 'Search for people'}).typeWithForce(unique).then(() => {
                cy.get('#multiSelectList').within(() => {
                    cy.get('.more-modal__details').should('have.length', 2);
                });

                // * Assert that total number of users is displayed correctly
                cy.get('#multiSelectHelpMemberInfo').should('contain', 'Use ↑↓ to browse, ↵ to select. You can add 7 more people. ').should('contain', `2 of ${totalUsers} members`);
            });
        });
    });
});
