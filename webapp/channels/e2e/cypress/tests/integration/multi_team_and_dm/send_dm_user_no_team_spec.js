// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @multi_team_and_dm

import * as TIMEOUTS from '../../fixtures/timeouts';
import * as MESSAGES from '../../fixtures/messages';

describe('Send a DM', () => {
    let userA;
    let userB;
    let team1;
    let testChannelUrl;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            userA = user;
            team1 = team;
            testChannelUrl = `/${team.name}/channels/town-square`;

            cy.apiCreateUser().then(({user: otherUser}) => {
                userB = otherUser;
                cy.apiAddUserToTeam(team.id, userB.id);
            });
        });
    });

    it('MM-T451 Send a DM to someone on no team', () => {
        // # Log in as UserA and leave all teams
        cy.apiLogin(userA);
        cy.visit(testChannelUrl);
        cy.get('#postListContent', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible');
        cy.uiGetLHSHeader().click();
        cy.findByText('Leave Team').click();
        cy.findByText('Yes').click();
        cy.url().should('include', '/select_team');

        // # Log in as User B and send User A a direct message
        cy.apiLogout();
        cy.apiLogin(userB);
        cy.visit(testChannelUrl);
        cy.uiAddDirectMessage().click();
        cy.get('#selectItems input').typeWithForce(userA.username).wait(TIMEOUTS.HALF_SEC);
        cy.get('#multiSelectList').findByText(`@${userA.username}`).click();
        cy.findByText('Go').click();
        cy.postMessage(MESSAGES.SMALL);

        // * From User B's perspective, message sends.
        cy.uiWaitUntilMessagePostedIncludes(MESSAGES.SMALL);

        // * The DM appears in your LHS / channel drawer even though other user isn't on any teams
        cy.uiGetLhsSection('DIRECT MESSAGES').findByText(userA.username).should('be.visible');

        // # Have User A re-join one of the teams
        cy.apiAddUserToTeam(team1.id, userA.id);

        // * After User A rejoins a team, the DM channel is visible to them in their LHS / channel drawer
        cy.apiLogout();
        cy.apiLogin(userA);
        cy.visit(testChannelUrl);
        cy.get('#postListContent', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible');
        cy.uiGetLhsSection('DIRECT MESSAGES').findByText(userB.username).should('be.visible');
    });
});
