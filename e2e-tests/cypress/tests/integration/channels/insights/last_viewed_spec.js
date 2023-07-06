// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************
// Stage: @prod
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Insights as last viewed channel', () => {
    let userA; // Member of team A and B
    let teamA;
    let teamB;
    let offTopicUrlA;
    let testChannel;

    before(() => {
        cy.shouldHaveFeatureFlag('InsightsEnabled', true);

        cy.apiInitSetup().then(({team, user, offTopicUrl: url}) => {
            userA = user;
            teamA = team;
            offTopicUrlA = url;

            cy.apiCreateUser().then(() => {
                return cy.apiCreateTeam('team', 'Team');
            }).then(({team: otherTeam}) => {
                teamB = otherTeam;
                return cy.apiAddUserToTeam(teamB.id, userA.id);
            }).then(() => {
                return cy.apiCreateChannel(teamA.id, 'test', 'Test');
            }).then(({channel}) => {
                testChannel = channel;
                return cy.apiAddUserToChannel(testChannel.id, userA.id);
            });
        });
    });

    beforeEach(() => {
        // # Log in to Team A with an account that has joined multiple teams.
        cy.apiLogin(userA);

        // # On an account on two teams, view Team A
        cy.visit(offTopicUrlA);
    });
});
