// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

import {
    getPostTextboxInput,
    getQuickChannelSwitcherInput,
    SimpleUser,
    startAtMention,
    verifySuggestionAtChannelSwitcher,
    verifySuggestionAtPostTextbox,
} from './helpers';

export function doTestPostextbox(mention: string, ...suggestion: Cypress.UserProfile[]) {
    getPostTextboxInput();
    startAtMention(mention);
    verifySuggestionAtPostTextbox(...suggestion);
}

export function doTestQuickChannelSwitcher(mention: string, ...suggestion: Cypress.UserProfile[]) {
    getQuickChannelSwitcherInput();
    startAtMention(mention);
    verifySuggestionAtChannelSwitcher(...suggestion);
}

export function doTestUserChannelSection(prefix: string, testTeam: Cypress.Team, testUsers: Record<string, SimpleUser>) {
    const thor = testUsers.thor;
    const loki = testUsers.loki;

    // # Create new channel and add user to channel
    const channelName = 'new-channel';
    cy.apiCreateChannel(testTeam.id, channelName, channelName).then(({channel}) => {
        cy.apiGetUserByEmail(thor.email).then(({user}) => {
            cy.apiAddUserToChannel(channel.id, user.id);
        });

        cy.visit(`/${testTeam.name}/channels/${channel.name}`);
    });

    // # Start an at mention that should return 2 users (in this case, the users share a last name)
    cy.uiGetPostTextBox().
        as('input').
        clear().
        type(`@${prefix}odinson`);

    // * Thor should be a channel member
    cy.uiVerifyAtMentionInSuggestionList(thor as Cypress.UserProfile, true);

    // * Loki should NOT be a channel member
    cy.uiVerifyAtMentionInSuggestionList(loki as Cypress.UserProfile, false);
}

export function doTestDMChannelSidebar(testUsers: Record<string, SimpleUser>) {
    const thor = testUsers.thor;

    // # Open of the add direct message modal
    cy.uiAddDirectMessage().click({force: true});

    // # Type username into input
    cy.get('.more-direct-channels').
        find('input').
        should('exist').
        type(thor.username, {force: true});

    cy.intercept({
        method: 'POST',
        url: '/api/v4/users/search',
    }).as('searchUsers');

    cy.wait('@searchUsers').then((interception) => {
        expect(interception.response.body.length === 1);
    });

    // * There should only be one result
    cy.get('#moreDmModal').find('.more-modal__row').
        as('result').
        its('length').
        should('equal', 1);

    // * Result should have appropriate text
    cy.get('@result').
        find('.more-modal__name').
        should('have.text', `@${thor.username} - ${thor.first_name} ${thor.last_name} (${thor.nickname})`);

    cy.get('@result').
        find('.more-modal__description').
        should('have.text', thor.email);

    // # Click on the result to add user
    cy.get('@result').click({force: true});

    // # Click "Go"
    cy.uiGetButton('Go').click();

    // # Should land on direct message channel for that user
    cy.get('#channelHeaderTitle').should('have.text', thor.username + ' ');
}
