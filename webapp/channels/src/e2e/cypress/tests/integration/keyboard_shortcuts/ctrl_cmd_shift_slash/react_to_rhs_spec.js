// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @emoji @keyboard_shortcuts

import * as TIMEOUTS from '../../../fixtures/timeouts';
import * as MESSAGES from '../../../fixtures/messages';

import {
    checkReactionFromPost,
    doReactToLastMessageShortcut,
} from './helpers';

describe('Keyboard shortcut CTRL/CMD+Shift+\\ for adding reaction to last message', () => {
    let testUser;
    let testTeam;

    before(() => {
        // # Enable Experimental View Archived Channels
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;
        });
    });

    beforeEach(() => {
        // # Login as test user and visit town-square
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/off-topic`);
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('contain', 'Off-Topic');

        // # Post a message without reaction for each test
        cy.postMessage(MESSAGES.TINY);
    });

    it('MM-T4058_1 Open emoji picker for root post in RHS when focus is on comment textbox', () => {
        // # Click post comment icon
        cy.clickPostCommentIcon();

        // * Check that the RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Do keyboard shortcut with focus on RHS
        doReactToLastMessageShortcut('RHS');

        // # Add reaction to a post
        cy.clickEmojiInEmojiPicker('smile');

        // * Check if emoji is shown as reaction to the last message (same in RHS)
        cy.getLastPostId().then((lastPostId) => {
            checkReactionFromPost(lastPostId);
        });

        cy.uiCloseRHS();
    });

    it('MM-T4058_2 Open emoji picker for last comment in RHS when focus is on comment textbox', () => {
        // # Click post comment icon
        cy.clickPostCommentIcon();

        // * Check that the RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Post few comments in RHS
        cy.postMessageReplyInRHS(MESSAGES.SMALL);
        cy.postMessageReplyInRHS(MESSAGES.TINY);

        // # Do keyboard shortcut with focus on RHS
        doReactToLastMessageShortcut('RHS');

        // # Add reaction to a post
        cy.clickEmojiInEmojiPicker('smile');

        // * Check if emoji is shown as reaction to the last message (same in RHS)
        cy.getLastPostId().then((lastPostId) => {
            checkReactionFromPost(lastPostId);
        });

        cy.uiCloseRHS();
    });

    it('MM-T4058_3 Open emoji picker for last comment in fully expanded RHS when focus is on comment textbox', () => {
        // # Click post comment icon
        cy.clickPostCommentIcon();

        // * Check that the RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Fully expand the RHS
        cy.uiExpandRHS();

        // # Do keyboard shortcut with focus on RHS
        doReactToLastMessageShortcut('RHS');

        // # Add reaction to a post
        cy.clickEmojiInEmojiPicker('smile');

        // * Check if emoji is shown as reaction to the last message (same in RHS)
        cy.getLastPostId().then((lastPostId) => {
            checkReactionFromPost(lastPostId);
        });
    });
});
