// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @multi_team_and_dm

describe('Send a DM', () => {
    let userA; // Member of team A and B
    let userB; // Member of team A and B
    let userC; // Member of team A
    let testChannel;
    let teamA;
    let teamB;
    let offTopicUrlA;
    let offTopicUrlB;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user, offTopicUrl: url}) => {
            userA = user;
            teamA = team;
            testChannel = channel;
            offTopicUrlA = url;

            cy.apiCreateUser().then(({user: otherUser}) => {
                userB = otherUser;
                return cy.apiAddUserToTeam(teamA.id, userB.id);
            }).then(() => {
                return cy.apiCreateUser();
            }).then(({user: otherUser}) => {
                userC = otherUser;
                return cy.apiAddUserToTeam(teamA.id, userC.id);
            }).then(() => {
                return cy.apiCreateTeam('team', 'Team');
            }).then(({team: otherTeam}) => {
                teamB = otherTeam;
                offTopicUrlB = `/${teamB.name}/channels/off-topic`;
                return cy.apiAddUserToTeam(teamB.id, userA.id);
            }).then(() => {
                return cy.apiAddUserToTeam(teamB.id, userB.id);
            });
        });
    });

    beforeEach(() => {
        // # Log in to Team A with an account that has joined multiple teams.
        cy.apiLogin(userA);

        // # On an account on two teams, view Team A
        cy.visit(offTopicUrlA);
    });

    it('MM-T433 Switch teams', () => {
        // # Open several DM channels, including accounts that are not on Team B.
        cy.apiCreateDirectChannel([userA.id, userB.id]).wait(TIMEOUTS.ONE_SEC).then(() => {
            cy.visit(`/${teamA.name}/channels/${userA.id}__${userB.id}`);
            cy.postMessage(':)');
            return cy.apiCreateDirectChannel([userA.id, userC.id]).wait(TIMEOUTS.ONE_SEC);
        }).then(() => {
            cy.visit(`/${teamA.name}/channels/${userA.id}__${userC.id}`);
            cy.postMessage(':(');
        });

        // # Click Team B in the team sidebar.
        cy.get(`#${teamB.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

        // * Channel list in the LHS is scrolled to the top.
        cy.uiGetLhsSection('CHANNELS').get('.active').should('contain', 'Town Square');

        // * Verify team display name changes correctly.
        cy.uiGetLHSHeader().findByText(teamB.display_name);

        // * DM Channel list should be the same on both teams with no missing names.
        cy.uiGetLhsSection('DIRECT MESSAGES').findByText(userB.username).should('be.visible');
        cy.uiGetLhsSection('DIRECT MESSAGES').findByText(userC.username).should('be.visible');

        // # Post a message in Off-Topic in Team B
        cy.uiClickSidebarItem('off-topic');
        cy.postMessage('Hello World');

        // * Verify posting a message works properly.
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('be.visible').and('have.text', 'Hello World');
        });

        // # Click Team A in the team sidebar.
        cy.get(`#${teamA.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

        // * Verify there is no cross contamination between teams.
        cy.get('#sidebarItem_off-topic').should('not.have.class', 'unread-title');

        // * DM Channel list should be the same on both teams with no missing names.
        cy.uiGetLhsSection('DIRECT MESSAGES').findByText(userB.username).should('be.visible');
        cy.uiGetLhsSection('DIRECT MESSAGES').findByText(userC.username).should('be.visible');

        // * Channel viewed on a team before switching should be the one that displays after switching back (Off-Topic does not briefly show).
        cy.url().should('include', `/${teamA.name}/messages/@${userC.username}`);
    });

    it('MM-T437 Multi-team mentions', () => {
        // # Have another user also on those two teams post two at-mentions for you on Team B
        cy.apiLogin(userB);

        cy.visit(offTopicUrlB);
        cy.postMessage(`@${userA.username} `);
        cy.postMessage(`@${userA.username} `);
        cy.apiLogout();

        cy.apiLogin(userA);
        cy.visit(offTopicUrlA);

        // * Observe a mention badge with "2" on Team B on your team sidebar
        cy.get(`#${teamB.name}TeamButton`).should('be.visible').within(() => {
            cy.get('.badge').contains('2');
        });
    });

    it('MM-T438 Multi-team unreads', () => {
        // # Go to team B, and make sure all mentions are read
        cy.visit(offTopicUrlB);
        cy.visit(`/${teamA.name}/channels/${testChannel.name}`);

        // * No dot appears for you on Team B since there are no more mentions
        cy.get(`#${teamB.name}TeamButton`).should('be.visible').within(() => {
            cy.get('.badge').should('not.exist');
        });

        // # Have the other user switch to Team A and post (a message, not a mention) in a channel you're a member of
        cy.apiLogin(userB);

        cy.visit(offTopicUrlA);
        cy.postMessage('Hey all');
        cy.apiLogout();

        // * Dot appears, with no number (just unread, not a mention)
        cy.apiLogin(userA);
        cy.visit(offTopicUrlB);
        cy.get(`#${teamA.name}TeamButton`).children('.unread').should('be.visible');
        cy.get(`#${teamA.name}TeamButton`).should('be.visible').within(() => {
            cy.get('.badge').should('not.exist');
        });
    });
});
