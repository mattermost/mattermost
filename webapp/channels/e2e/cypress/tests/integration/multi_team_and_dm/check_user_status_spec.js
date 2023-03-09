// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';
import * as MESSAGES from '../../fixtures/messages';

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @multi_team_and_dm

describe('Multi-Team + DMs', () => {
    let userA;
    let userB;
    let testChannelUrl;

    const away = {name: 'away', ariaLabel: 'Away Icon', message: 'You are now away', className: 'icon-clock'};
    const online = {name: 'online', ariaLabel: 'Online Icon', message: 'You are now online', className: 'icon-check', profileClassName: 'icon-check-circle'};

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            userA = user;
            testChannelUrl = `/${team.name}/channels/town-square`;

            cy.apiCreateUser().then(({user: otherUser}) => {
                userB = otherUser;
                cy.apiAddUserToTeam(team.id, userB.id);
            });
        });
    });

    it('MM-T423 Online Status - Statuses update in center, in member icon drop-down, and in DM LHS sidebar', () => {
        // # Login with UserB and post a message to UserA
        cy.apiLogin(userB);
        cy.visit(testChannelUrl);
        cy.postMessage(MESSAGES.SMALL);
        cy.uiAddDirectMessage().click();
        cy.get('#selectItems').typeWithForce(userA.username);
        cy.findByText('Loading').should('be.visible');
        cy.findByText('Loading').should('not.exist');
        cy.get('#multiSelectList').findByText(`@${userA.username}`).click();
        cy.findByText('Go').click();
        cy.postMessage(MESSAGES.SMALL);

        // # Set online status and verify it's changed as the initial status
        setStatus(online.name, online.profileClassName);
        verifyUserStatus(away);

        // # Login with UserA and verify Status of UserB
        cy.apiLogout();
        cy.apiLogin(userA);
        cy.visit(testChannelUrl);

        // * Verify status shown at username in the DM list on LHS
        cy.get(`[aria-label^="${userB.username}"]`).
            children().
            find('i').should('have.class', 'status-away');

        // * Verify user's status show in the members list on RHS
        cy.get('#member_rhs').click();
        cy.get('#rhsContainer').should('be.visible');
        cy.get(`[data-testid="memberline-${userB.id}"]`).
            should('be.visible').
            children('div.Avatar-IGMzc').
            children().
            find('svg').should('have.attr', 'aria-label', 'Away Icon');
    });
});

function setStatus(status, icon) {
    cy.apiUpdateUserStatus(status);
    cy.uiGetProfileHeader().
        find('i').
        and('have.class', icon);
}

function verifyUserStatus(testCase) {
    // # Clear then type '/'
    cy.uiGetPostTextBox().clear().type('/');

    // * Verify that the suggestion list is visible
    cy.get('#suggestionList').should('be.visible');

    // # Post slash command to change user status
    cy.uiGetPostTextBox().type(`${testCase.name}{enter}`).wait(TIMEOUTS.ONE_HUNDRED_MILLIS).type('{enter}');

    // * Get last post and verify system message
    cy.getLastPost().within(() => {
        cy.findByText(testCase.message);
        cy.findByText('(Only visible to you)');
    });

    // * Verify status shown at user profile in LHS
    cy.uiGetProfileHeader().
        find('i').
        and('have.class', testCase.profileClassName || testCase.className);

    // # Post a message
    cy.postMessage(testCase.name);

    // * Verify that the profile in the posted message shows correct status
    cy.get('.post__img').last().findByLabelText(testCase.ariaLabel);
}
