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
    let otherUser;
    let testTeam;
    let offTopicChannel;

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

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiGetChannelByName(testTeam.name, 'off-topic').then((out) => {
                    offTopicChannel = out.channel;
                });

                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });
        });
    });

    beforeEach(() => {
        // # Login as test user and visit off-topic
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/off-topic`);
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('contain', 'Off-Topic');

        // # Post a message without reaction for each test
        cy.postMessage('hello');
    });

    it('MM-T4060_1 Open emoji picker on center when focus is neither on center or comment textbox even if RHS is opened', () => {
        // # Click post comment icon
        cy.clickPostCommentIcon();

        // * Check that RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Post couple of comments in RHS.
        cy.postMessageReplyInRHS(MESSAGES.SMALL);
        cy.postMessageReplyInRHS(MESSAGES.TINY);

        // # Save the post ID where reaction should not be added
        cy.getLastPostId().as('prevLastPostId');

        // # Have another user post a message
        cy.postMessageAs({
            sender: otherUser,
            message: MESSAGES.MEDIUM,
            channelId: offTopicChannel.id,
        });
        cy.wait(TIMEOUTS.TWO_SEC);

        // # Click anywhere to take focus away from RHS text box
        cy.get('body').click();
        cy.wait(TIMEOUTS.TWO_SEC);

        // # Do keyboard shortcut without focus on center
        doReactToLastMessageShortcut();

        // # Add reaction to a post
        cy.clickEmojiInEmojiPicker('smile');

        // * Check if emoji reaction is shown in the last message in center
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#post_${lastPostId}`).findByLabelText('remove reaction smile').should('exist');
        });

        // * Check if no emoji reaction is shown from last comment both in RHS and center
        cy.get('@prevLastPostId').then((lastPostId) => {
            cy.get(`#rhsPost_${lastPostId}`).findByLabelText('remove reaction smile').should('not.exist');
            cy.get(`#post_${lastPostId}`).findByLabelText('remove reaction smile').should('not.exist');
        });

        cy.uiCloseRHS();
    });

    it('MM-T4060_2 Open emoji picker on center when focus is on center text box even if RHS is opened', () => {
        // # Click post comment icon
        cy.clickPostCommentIcon();

        // * Check that RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Post couple of comments in RHS.
        cy.postMessageReplyInRHS(MESSAGES.SMALL);
        cy.postMessageReplyInRHS(MESSAGES.TINY);

        // # Get the last post ID in RHS where reaction should not be added
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).as('postInRHS');
        });

        // # Have another user post a message to a channel
        cy.postMessageAs({
            sender: otherUser,
            message: MESSAGES.MEDIUM,
            channelId: offTopicChannel.id,
        });
        cy.wait(TIMEOUTS.FIVE_SEC);

        // # Click anywhere to take focus away from RHS text box
        cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();

        // # Do keyboard shortcut with focus on center
        doReactToLastMessageShortcut('CENTER');

        // # Add reaction to a post
        cy.clickEmojiInEmojiPicker('smile');

        // # This post is in Center, where reaction is to be added
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).as('postInCenter');
        });

        // * Check if emoji is shown as reaction to the message in center
        cy.getLastPostId().then((lastPostId) => {
            checkReactionFromPost(lastPostId);
        });

        // * Check if no emoji reaction is shown in the last comment at RHS
        cy.get('@postInRHS').within(() => {
            cy.findByLabelText('reactions').should('not.exist');
            cy.findByLabelText('remove reaction smile').should('not.exist');
        });

        cy.uiCloseRHS();
    });

    it('MM-T1804_1 Open emoji picker for last message when focus is on center textbox', () => {
        // # Do keyboard shortcut with focus on center
        doReactToLastMessageShortcut('CENTER');

        // # Add reaction to a post
        cy.clickEmojiInEmojiPicker('smile');

        // * Check if emoji is shown as reaction to last message
        cy.getLastPostId().then((lastPostId) => {
            checkReactionFromPost(lastPostId);
        });
    });

    it('MM-T1804_2 Open emoji picker for last message even when focus is not on center textbox', () => {
        // # Click anywhere to take focus away from center text box
        cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();

        // # Do keyboard shortcut without focus on center
        doReactToLastMessageShortcut();

        // # Add reaction to a post
        cy.clickEmojiInEmojiPicker('smile');

        // * Check if emoji is shown as reaction to last message
        cy.getLastPostId().then((lastPostId) => {
            checkReactionFromPost(lastPostId);
        });
    });

    it('MM-T1804_3 Should reopen emoji picker even if shortcut is hit repeatedly on center', () => {
        // # Do keyboard shortcuts then escape multiple times, and
        // * verify that emoji picker open up each time
        Cypress._.times(3, () => {
            doReactToLastMessageShortcut('CENTER');
            cy.get('#emojiPicker').should('exist');
            cy.get('body').click();
            cy.get('#emojiPicker').should('not.exist');
        });

        // # Do keyboard shortcut with focus on center
        doReactToLastMessageShortcut('CENTER');

        // # Add reaction to a post
        cy.clickEmojiInEmojiPicker('smile');

        // * Check if emoji is shown as reaction to last message
        cy.getLastPostId().then((lastPostId) => {
            checkReactionFromPost(lastPostId);
        });
    });

    it('MM-T1804_4 Should add reaction to same post on which emoji picker was opened', () => {
        // # Save the post id which user initially intended to add reaction to, for later use
        cy.getLastPostId().then((lastPostId) => {
            cy.wrap(lastPostId).as('postIdForAddingReaction');
        });

        // # Do keyboard shortcut without focus
        doReactToLastMessageShortcut();

        // * Check that emoji picker is open
        cy.get('#emojiPicker').should('exist');

        // # While open, have another user post a message to a channel
        cy.postMessageAs({
            sender: otherUser,
            message: MESSAGES.TINY,
            channelId: offTopicChannel.id,
        });
        cy.wait(TIMEOUTS.FIVE_SEC);

        // * Check if emoji picker is still open and add a reaction
        cy.clickEmojiInEmojiPicker('smile');

        // * Check if emoji is shown as reaction to the message it initially intended
        cy.get('@postIdForAddingReaction').then((postIdForAddingReaction) => {
            checkReactionFromPost(postIdForAddingReaction);
        });

        // * Check if last message didn't get a reaction
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).within(() => {
                cy.findByLabelText('reactions').should('not.exist');
                cy.findByLabelText('remove reaction smile').should('not.exist');
            });
        });
    });
});
