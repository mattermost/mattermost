// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @collapsed_reply_threads

describe('Collapsed Reply Threads', () => {
    let userA; // Member of team A and B
    let teamA;
    let teamB;
    let offTopicUrlA;
    let testChannel;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_on',
            },
        });

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

    it('MM-T4887 should stay on threads view when switching teams', () => {
        // # Navigate to the new teams town square
        cy.visit(`/${teamA.name}/channels/town-square`);

        // # Switch to Team B
        cy.get(`#${teamB.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

        // * Verify team display name changes correctly.
        cy.uiGetLHSHeader().findByText(teamB.display_name);

        // # Go to the ‘Threads’ view on Team B
        cy.uiGetSidebarThreadsButton().click();

        cy.wait(TIMEOUTS.ONE_SEC);

        // # Switch back to Team A
        cy.get(`#${teamA.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

        // Verify url is set up for threads view
        cy.url().should('include', `${teamA.name}/threads`);
    });

    it('MM-T4843_1 should go to threads view when switching a team if that was the last view on that team', () => {
        // # Go to the ‘Threads’ view on Team A
        cy.uiGetSidebarThreadsButton().click();

        // # Switch to Team B
        cy.get(`#${teamB.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

        // * Verify team display name changes correctly.
        cy.uiGetLHSHeader().findByText(teamB.display_name);

        // # Switch back to Team A
        cy.get(`#${teamA.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

        // Verify url is set up for threads view
        cy.url().should('include', `${teamA.name}/threads`);
    });

    it('MM-T4843_2 should go to threads view when threads view is the penultimate view and leave the current channel', () => {
        // # Go to the ‘Threads’ view on Team A
        cy.uiGetSidebarThreadsButton().click();

        // # Switch to Test Channel
        cy.uiClickSidebarItem(testChannel.name);

        // # Leave the current channel
        cy.uiLeaveChannel();

        // Verify url is set up for threads view when thread view is the penultimate view
        cy.url().should('include', `${teamA.name}/threads`);
    });
});
