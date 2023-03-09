// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @integrations

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Integrations', () => {
    const away = {name: 'away', ariaLabel: 'Away Icon', message: 'You are now away', className: 'icon-clock'};
    const offline = {name: 'offline', ariaLabel: 'Offline Icon', message: 'You are now offline', className: 'icon-circle-outline'};
    const online = {name: 'online', ariaLabel: 'Online Icon', message: 'You are now online', className: 'icon-check', profileClassName: 'icon-check-circle'};

    before(() => {
        // # Login as test user and go to off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T670 /away', () => {
        // # Set online status and verify it's changed as the initial status
        setStatus(online.name, online.profileClassName);

        verifyUserStatus(away);
    });

    it('MM-T672 /offline', () => {
        // # Set online status and verify it's changed as the initial status
        setStatus(online.name, online.profileClassName);

        verifyUserStatus(offline);

        // # Switch to off-topic channel
        cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();
        cy.findByLabelText('channel header region').findByText('Off-Topic').should('be.visible');

        // # Then switch back to off-topic channel again
        cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();
        cy.findByLabelText('channel header region').findByText('Off-Topic').should('be.visible');

        // * Should not appear "New Messages" line
        cy.findByText('New Messages').should('not.exist');

        // # Get the system message
        cy.uiGetNthPost(-2).within(() => {
            cy.findByText(offline.message);

            // * Verify system message profile is visible and without status
            cy.findByLabelText('Mattermost Logo').should('be.visible');
            cy.get('.post__img').find('.status').should('not.exist');
        });
    });

    it('MM-T674 /online', () => {
        // # Set offline status and verify it's changed as the initial status
        setStatus(offline.name, offline.className);

        verifyUserStatus(online);
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

    // Verify that the profile in the posted message shows correct status
    cy.get('.post__img').last().findByLabelText(testCase.ariaLabel);
}
