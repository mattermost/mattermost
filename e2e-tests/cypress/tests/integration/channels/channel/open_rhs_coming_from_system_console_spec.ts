// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @rhs

import * as TIMEOUTS from '../../../fixtures/timeouts';
import * as MESSAGES from '../../../fixtures/messages';

describe('Channel RHS', () => {
    let testAdmin: Cypress.UserProfile;
    let testTeam: Cypress.Team;
    let testChannel: Cypress.Channel;

    before(() => {
        cy.apiCreateCustomAdmin({loginAfter: true}).then(({sysadmin}) => {
            testAdmin = sysadmin;

            cy.apiCreateTeam('team1', 'team1').then(({team}) => {
                testTeam = team;

                cy.apiAddUserToTeam(testTeam.id, testAdmin.id);

                cy.apiCreateChannel(testTeam.id, 'channel', 'channel', 'O').then(({channel}) => {
                    testChannel = channel;

                    cy.apiAddUserToChannel(channel.id, testAdmin.id);
                    cy.apiSaveCRTPreference(testAdmin.id, 'off');

                    cy.apiLogin(testAdmin);
                });
            });
        });
    });

    beforeEach(() => {
        // # Go to test channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-44435 - should be able to open channel info, visit the system console and come back without issues -- KNOWN ISSUE: MM-47226', () => {
        // # Click on the channel info button
        cy.uiGetChannelInfoButton().click();

        // * Verify that the channel info is opened in RHS
        verifyRHSisOpenAndHasTitle('Info');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the channel info is still opened in RHS
        verifyRHSisOpenAndHasTitle('Info');
    });

    it('MM-T5311 - should be able to open recent mentions, visit the system console and come back without issues', () => {
        // # Click on the recent mentions button
        cy.uiGetRecentMentionButton().click();

        // * Verify that the recent mentions is opened in RHS
        verifyRHSisOpenAndHasTitle('Recent Mentions');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the recent mentions is still opened in RHS
        verifyRHSisOpenAndHasTitle('Recent Mentions');
    });

    it('MM-T5312 - should be able to open saved messages, visit the system console and come back without issues', () => {
        // # Click on the saved messages button
        cy.uiGetSavedPostButton().click();

        // * Verify that the saved messages is opened in RHS
        verifyRHSisOpenAndHasTitle('Saved messages');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the saved messages is still opened in RHS
        verifyRHSisOpenAndHasTitle('Saved messages');
    });

    it('MM-T5313 - should be able to open Pinned messages, visit the system console and come back without issues', () => {
        // # Click on the Pinned messages button
        cy.uiGetChannelPinButton().click();

        // * Verify that the Pinned messages is opened in RHS
        verifyRHSisOpenAndHasTitle('Pinned messages');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the Pinned messages is still opened in RHS
        verifyRHSisOpenAndHasTitle('Pinned messages');
    });

    it('MM-T5314 - should be able to open channel members, visit the system console and come back without issues', () => {
        // # Click on the channel members button
        cy.uiGetChannelMemberButton().click();

        // * Verify that the channel members is opened in RHS
        verifyRHSisOpenAndHasTitle('Members');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the channel members is still opened in RHS
        verifyRHSisOpenAndHasTitle('Members');
    });

    it('MM-T5315 - should be able to open channel files, visit the system console and come back without issues', () => {
        // # Click on the channel files button
        cy.uiGetChannelFileButton().click();

        // * Verify that the channel files is opened in RHS
        verifyRHSisOpenAndHasTitle('Recent files');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the channel files is still opened in RHS
        verifyRHSisOpenAndHasTitle('Recent files');
    });

    it('MM-T5316 - should be able to open search results, visit the system console and come back without issues', () => {
        // # Post a message
        cy.postMessage(MESSAGES.SMALL);

        // # Enter the search terms and hit enter to start the search
        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().first().clear().type(MESSAGES.TINY).type('{enter}');

        // * Verify that the search results is opened in RHS
        verifyRHSisOpenAndHasTitle('Search Results');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the search results is still opened in RHS
        verifyRHSisOpenAndHasTitle('Search Results');
    });

    it('MM-T5317 - should be able to open thread reply, visit the system console and come back without issues', () => {
        // # Post a message
        cy.postMessage(MESSAGES.SMALL);

        // # Click on the reply button
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
        });

        // * Verify that the thread reply is opened in RHS
        verifyRHSisOpenAndHasTitle('Thread');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the thread reply is still opened in RHS
        verifyRHSisOpenAndHasTitle('Thread');
    });

    it('MM-T5318 - should be able to open thread reply with CRT, visit the system console and come back without issues', () => {
        // # Enable CRT
        cy.apiSaveCRTPreference(testAdmin.id, 'on');

        // # Refresh the page
        cy.reload();

        // # Post a message
        cy.postMessage(MESSAGES.SMALL);

        // # Click on the reply button
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
        });

        // * Verify that the thread reply is opened in RHS
        verifyRHSisOpenAndHasTitle('Thread');

        // # visit the system console and leave it
        openSystemConsoleAndLeave();

        // * Verify that the thread reply is still opened in RHS
        verifyRHSisOpenAndHasTitle('Thread');
    });
});

function openSystemConsoleAndLeave() {
    // # visit the system console...
    cy.uiOpenProductMenu('System Console');

    cy.wait(TIMEOUTS.THREE_SEC);

    // # ...and leave it
    cy.get('.backstage-navbar__back').click();
}

function verifyRHSisOpenAndHasTitle(title: string) {
    cy.get('#sidebar-right').should('exist').within(() => {
        cy.findByText(title).should('exist').and('be.visible');
    });
}
