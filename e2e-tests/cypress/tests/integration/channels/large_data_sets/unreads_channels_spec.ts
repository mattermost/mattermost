// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @large_data_set

describe('unreads channels', () => {
    let adminUser: Cypress.UserProfile;
    let otherUser: Cypress.UserProfile;

    const numOfTeams = 3;
    const createdTeams: Cypress.Team[] = [];
    const createdChannels: Cypress.Channel[] = [];

    before(() => {
        cy.apiInitSetup({promoteNewUserAsAdmin: true}).then(({user: admin, team, channel}) => {
            adminUser = admin;

            cy.apiCreateUser({prefix: 'other'}).then(({user: testUser}) => {
                otherUser = testUser;

                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, otherUser.id);

                    cy.apiLogin(adminUser);

                    Cypress._.times(numOfTeams, (i) => {
                        cy.apiCreateTeam(`team-${i}`, `team-${i}`).then(({team: newTeam}) => {
                            createdTeams.push(newTeam);

                            // # Create a channel for each new team
                            cy.apiCreateChannel(newTeam.id, `channel-${i}`, `channel-${i}`).then(({channel: newChannel}) => {
                                createdChannels.push(newChannel);

                                cy.apiAddUserToTeam(newTeam.id, otherUser.id).then(() => {
                                    cy.apiAddUserToChannel(newChannel.id, otherUser.id);
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(otherUser);
    });

    it('Check unreads on each team\'s channel', () => {
        // # Visit first's team channel
        cy.visit(`/${createdTeams[0].name}/channels/${createdChannels[0].name}`);

        // * Verify team's sidebar is visible
        cy.get('#teamSidebarWrapper').should('be.visible');

        Cypress._.times(numOfTeams, (i) => {
            // # Go to each created team with the team button
            cy.get(`#${createdTeams[i].name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

            cy.get('#SidebarContainer').should('be.visible').within(() => {
                // # Click on each created channel
                cy.findByText(createdChannels[i].display_name).should('be.visible').click();
            });

            // # Verify the channel is not read only
            cy.findByTestId('post_textbox').should('not.be.disabled');
        });
    });
});
