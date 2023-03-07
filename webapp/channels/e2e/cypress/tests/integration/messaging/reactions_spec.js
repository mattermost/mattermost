// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Messaging', () => {
    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            cy.apiLogin(user);
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T2189 Emoji reaction - type +:+1:', () => {
        // # Post a message
        cy.postMessage('Hello');

        cy.getLastPostId().then((postId) => {
            // # Click reply to open the post in the right hand side
            cy.clickPostCommentIcon(postId);

            // # Type "+:+1:" in comment box to react to the post with a thumbs-up and post
            cy.postMessageReplyInRHS('+:+1:');

            // * Thumbs-up reaction displays as reaction on post
            cy.get(`#${postId}_message`).within(() => {
                cy.findByLabelText('reactions').should('be.visible');
                cy.findByLabelText('remove reaction +1').should('be.visible');
            });

            // # Close RHS
            cy.uiCloseRHS();
        });
    });

    it('MM-T2190 Emoji reaction - click `+` next to existing reaction (center)', () => {
        // # Post a message
        cy.postMessage('Hello to yourself');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Add a reaction to the post
            cy.clickEmojiInEmojiPicker('smiley');

            // # Click the `+` button next to the existing reactions (visible on hover)
            cy.get(`#addReaction-${postId}`).should('exist').click({force: true});

            // # Click to select an emoji from the picker
            cy.clickEmojiInEmojiPicker('upside_down_face');

            // * Emoji reaction is added to the post
            cy.get(`#${postId}_message`).within(() => {
                cy.findByLabelText('reactions').should('exist');
                cy.findByLabelText('remove reaction upside down face').should('exist');
            });

            // * Reaction appears in recently used section of emoji picker
            cy.uiOpenEmojiPicker().then(() => {
                cy.findAllByTestId('emojiItem').first().within(($el) => {
                    cy.wrap($el).findByTestId('upside_down_face').should('exist');
                });
            });
        });
    });

    it('MM-T2192 RHS (reply) shows emoji picker for reactions - Reply box and plus icon', () => {
        // # Post a message
        cy.postMessage('Hello to you all');

        cy.getLastPostId().then((postId) => {
            // # Click a reply arrow to open reply RHS
            cy.clickPostCommentIcon(postId).then(() => {
                // # Click the expand arrows in top right to expand RHS
                cy.uiExpandRHS();

                // # mouse ove the root post
                cy.get(`#rhsPost_${postId}`).trigger('mouseover');

                // # Hover over the message, observe emoji picker icon
                cy.get(`#RHS_ROOT_reaction_${postId}`).should('exist').click({force: true});

                // # Click the emoji picker icon to react to the message, select a reaction
                cy.clickEmojiInEmojiPicker('smiley');

                // # Hover over the post again and observe the `+` icon next to your reaction
                cy.get(`#addReaction-${postId}`).should('exist').click({force: true});

                // # Click the `+` icon and select a different reaction
                cy.clickEmojiInEmojiPicker('upside_down_face');

                // * Two reactions are added to the message in the expanded RHS
                cy.get(`#rhsPost_${postId}`).within(() => {
                    cy.findByLabelText('reactions').should('be.visible');
                    cy.findByLabelText('remove reaction smiley').should('be.visible');
                    cy.findByLabelText('remove reaction upside down face').should('be.visible');
                });

                // # Close RHS
                cy.uiCloseRHS();
            });
        });
    });

    it('MM-T2195 Emoji reaction - not available on system message Save - not available on system message Pin - not available on system message Can delete your own system message', () => {
        // # Click add a channel header
        cy.findByRoleExtended('button', {name: 'Add a channel header'}).should('be.visible').click();

        // # Add or update a channel header
        cy.get('#editChannelHeaderModalLabel').should('be.visible');
        cy.get('textarea#edit_textbox').should('be.visible').type('This is a channel description{enter}');

        cy.getLastPostId().then((postId) => {
            // * Emoji reaction - not available on system message
            cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.HALF_SEC).get(`#CENTER_reaction_${postId}`).should('not.exist');

            // * Save - not available on system message
            cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.HALF_SEC).get(`#CENTER_flagIcon_${postId}`).should('not.exist');

            // * Pin - not available on system message
            cy.get(`#post_${postId}`).should('be.visible').within(() => {
                cy.get('.post-menu').should('be.visible').within(() => {
                    return cy.findByText('Pin to Channel').should('not.exist');
                });
            });

            // * If permissions allow, can click [...] >
            cy.clickPostDotMenu(postId);

            // # Delete to delete system message
            cy.get(`#delete_post_${postId}`).click();

            // * Check that confirmation dialog is open.
            cy.get('#deletePostModal').should('be.visible');

            // # Confirm deletion.
            cy.get('#deletePostModalButton').click();
        });
    });

    it('MM-T2196 Emoji reaction - not available on ephemeral message Save - not available on ephemeral message Pin - not available on ephemeral message Timestamp - not a link on ephemeral message Can close ephemeral message', () => {
        // # Post `/away` to create an ephemeral message
        cy.postMessage('/away ');

        cy.getLastPostId().then((postId) => {
            // * (Only visible to you) displays next to timestamp (standard view) or after message text (compact view)
            cy.get(`#post_${postId}`).should('be.visible').within(() => {
                cy.findByText('(Only visible to you)').should('exist');
            });

            // * Emoji reactions are not available on ephemeral messages
            cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.HALF_SEC).get(`#CENTER_reaction_${postId}`).should('not.exist');

            // * Save not available on ephemeral messages
            cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.HALF_SEC).get(`#CENTER_flagIcon_${postId}`).should('not.exist');

            // * Pin not available on ephemeral messages
            cy.get(`#post_${postId}`).within(() => {
                cy.wait(TIMEOUTS.HALF_SEC).get('.post-menu').should('not.exist');
            });

            // * Timestamp is not a link on ephemeral messages
            cy.get(`#post_${postId}`).then((post) => {
                cy.wrap(post).find('time.post__time').invoke('text');
                cy.url().should('not.include', postId);
            });

            // * Can click `x` to close ephemeral message
            cy.wait(TIMEOUTS.HALF_SEC).get('button.post__remove').click({force: true});
            cy.get(`#post_${postId}`).should('not.exist');
        });
    });
});
