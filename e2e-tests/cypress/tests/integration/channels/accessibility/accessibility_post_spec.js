// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @accessibility

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getRandomId} from '../../../utils';

describe('Verify Accessibility Support in Post', () => {
    let testUser;
    let otherUser;
    let testTeam;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testTeam = team;
            testChannel = channel;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as test user and visit the test channel
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        cy.get('#postListContent', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
    });

    it('MM-T1479 Verify Reader reads out the post correctly on Center Channel', () => {
        const {lastMessage} = postMessages(testChannel, otherUser, 1);
        performActionsToLastPost();

        // # Shift focus to the last post
        cy.get('#FormattingControl_bold').focus().tab({shift: true}).tab({shift: true});
        cy.get('body').type('{uparrow}{downarrow}');

        // * Verify post message in Center Channel
        cy.getLastPostId().then((postId) => {
            // * Verify reader reads out the post correctly
            verifyPostLabel(`#post_${postId}`, otherUser.username, `wrote, ${lastMessage}, 2 reactions, message is saved and pinned`);
        });
    });

    it('MM-T1480 Verify Reader reads out the post correctly on RHS', () => {
        const {lastMessage} = postMessages(testChannel, otherUser, 1);
        performActionsToLastPost();

        // # Post a reply on RHS
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
            cy.get('#rhsContainer').should('be.visible');
            const replyMessage = 'A reply to an older post';
            cy.postMessageReplyInRHS(replyMessage);

            // * Verify post message in RHS
            cy.get('#rhsContainer').within(() => {
                // # Shift the focus to the last post
                cy.get('#FormattingControl_bold').focus().tab({shift: true}).tab({shift: true}).type('{uparrow}');

                // * Verify reader reads out the post correctly
                verifyPostLabel(`#rhsPost_${postId}`, otherUser.username, `wrote, ${lastMessage}, 2 reactions, message is saved and pinned`);
            });

            // * Verify reply message in RHS
            cy.getLastPostId().then((replyId) => {
                cy.get('#rhsContainer').within(() => {
                    // # Shift the focus to the last reply message
                    cy.get('#FormattingControl_bold').focus().tab({shift: true}).tab({shift: true}).type('{uparrow}{downarrow}');

                    // * Verify reader reads out the post correctly
                    verifyPostLabel(`#rhsPost_${replyId}`, testUser.username, `replied, ${replyMessage}`);
                });
            });
        });
    });

    it('MM-T1486_1 Verify different Post Focus on Center Channel', () => {
        postMessages(testChannel, otherUser, 5);

        // # Shift focus to the last post
        cy.get('#FormattingControl_bold').focus().tab({shift: true}).tab({shift: true}).type('{uparrow}');

        // * Verify if focus changes to different posts when we use up arrows
        for (let index = 1; index < 5; index++) {
            cy.getNthPostId(-index - 1).then((postId) => {
                cy.get(`#post_${postId}`).should('be.focused');
                cy.get('body').type('{uparrow}');
            });
        }

        // * Verify if focus changes to different posts when we use down arrows
        for (let index = 5; index > 0; index--) {
            cy.getNthPostId(-index - 1).then((postId) => {
                cy.get(`#post_${postId}`).should('be.focused');
                cy.get('body').type('{downarrow}');
            });
        }
    });

    it('MM-T1486_2 Verify different Post Focus on RHS', () => {
        // # Post Message as Current user
        const message = `hello from current user: ${getRandomId()}`;
        cy.postMessage(message);

        // # Post few replies on RHS
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
            cy.get('#rhsContainer').should('be.visible');

            for (let index = 0; index < 3; index++) {
                const replyMessage = `A reply ${getRandomId()}`;
                cy.postMessageReplyInRHS(replyMessage);
                const otherMessage = `reply from ${otherUser.username}: ${getRandomId()}`;
                cy.postMessageAs({sender: otherUser, message: otherMessage, channelId: testChannel.id, rootId: postId});
            }
        });

        cy.get('#rhsContainer').within(() => {
            // # Shift focus to the last post
            cy.get('#FormattingControl_bold').focus().tab({shift: true}).tab({shift: true}).type('{uparrow}');
        });

        // * Verify if focus changes to different posts when we use up arrows
        for (let index = 1; index < 5; index++) {
            cy.getNthPostId(-index - 1).then((postId) => {
                cy.get(`#rhsPost_${postId}`).should('be.focused');
                cy.get('body').type('{uparrow}');
            });
        }

        // * Verify if focus changes to different posts when we use down arrows
        for (let index = 5; index > 1; index--) {
            cy.getNthPostId(-index - 1).then((postId) => {
                cy.get(`#rhsPost_${postId}`).should('be.focused');
                cy.get('body').type('{downarrow}');
            });
        }
    });

    it('MM-T1486_3 Verify Tab support on Post on Center Channel', () => {
        postMessages(testChannel, otherUser, 1);

        // # Shift focus to the last post
        cy.get('#FormattingControl_bold').focus().tab({shift: true}).tab({shift: true}).type('{uparrow}{downarrow}');
        cy.focused().tab();

        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(() => {
                // * Verify focus is on profile image
                cy.get('.status-wrapper button').first().should('be.focused');
                cy.focused().tab();

                // * Verify focus is on the username
                cy.get('button.user-popover').should('be.focused').and('have.attr', 'aria-label', otherUser.username);
                cy.focused().tab();

                // * Verify focus is on the time
                cy.get(`#CENTER_time_${postId}`).should('be.focused');
                cy.focused().tab();

                for (let i = 0; i < 3; i++) {
                    // * Verify focus is on the reactions button
                    cy.get(`#recent_reaction_${i}`).should('have.class', 'emoticon--post-menu').and('have.attr', 'aria-label');
                    cy.focused().tab();
                }

                // * Verify focus is on the reactions button
                cy.get(`#CENTER_reaction_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'add reaction');
                cy.focused().tab();

                // * Verify focus is on the save post button
                cy.get(`#CENTER_flagIcon_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'save');
                cy.focused().tab();

                // * Verify focus is on message actions button
                cy.get(`#CENTER_actions_button_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'actions');
                cy.focused().tab();

                // * Verify focus is on the comment button
                cy.get(`#CENTER_commentIcon_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'reply');
                cy.focused().tab();

                // * Verify focus is on the more button
                cy.get(`#CENTER_button_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'more');
                cy.focused().tab();

                // * Verify focus is on the post text
                cy.get(`#postMessageText_${postId}`).should('be.focused').and('have.attr', 'aria-readonly', 'true');
            });
        });
    });

    it('MM-T1486_4 Verify Tab support on Post on RHS', () => {
        // # Post Message as Current user
        const message = `hello from current user: ${getRandomId()}`;
        cy.postMessage(message);

        // # Post few replies on RHS
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
            cy.get('#rhsContainer').should('be.visible');

            const replyMessage = `A reply ${getRandomId()}`;
            cy.postMessageReplyInRHS(replyMessage);
            const otherMessage = `reply from ${otherUser.username}: ${getRandomId()}`;
            cy.postMessageAs({sender: otherUser, message: otherMessage, channelId: testChannel.id, rootId: postId});
        });

        cy.get('#rhsContainer').within(() => {
            // # Shift focus to the last post
            cy.get('#FormattingControl_bold').focus().tab({shift: true}).tab({shift: true});
        });

        // * Verify reverse tab on RHS
        cy.getLastPostId().then((postId) => {
            cy.get(`#rhsPost_${postId}`).within(() => {
                // * Verify focus is on the post text
                cy.get(`#rhsPostMessageText_${postId}`).should('be.focused').and('have.attr', 'aria-readonly', 'true');
                cy.focused().tab({shift: true});

                // * Verify focus is on the more button
                cy.get(`#RHS_COMMENT_button_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'more');
                cy.focused().tab({shift: true});

                // * Verify focus is on message actions button
                cy.get(`#RHS_COMMENT_actions_button_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'actions');
                cy.focused().tab({shift: true});

                // * Verify focus is on the save icon
                cy.get(`#RHS_COMMENT_flagIcon_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'save');
                cy.focused().tab({shift: true});

                // * Verify focus is on the reactions button
                cy.get(`#RHS_COMMENT_reaction_${postId}`).should('be.focused').and('have.attr', 'aria-label', 'add reaction');
                cy.focused().tab({shift: true});

                // * Verify focus is on most recent action
                cy.get('#recent_reaction_0').should('have.class', 'emoticon--post-menu').and('have.attr', 'aria-label');
                cy.focused().tab({shift: true});

                // * Verify focus is on the time
                cy.get(`#RHS_COMMENT_time_${postId}`).should('be.focused');
                cy.focused().tab({shift: true});

                // * Verify focus is on the username
                cy.get('button.user-popover').should('be.focused').and('have.attr', 'aria-label', otherUser.username);
                cy.focused().tab({shift: true});
            });
        });
    });

    it('MM-T1462 Verify incoming messages are read', () => {
        // # Make channel as read by switching back and forth to testChannel
        cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();
        cy.get('#postListContent', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        cy.uiGetLhsSection('CHANNELS').findByText(testChannel.display_name).click();
        cy.get('#postListContent', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // # Submit a post as another user
        const message = `verify incoming message from ${otherUser.username}: ${getRandomId()}`;
        cy.postMessageAs({sender: otherUser, message, channelId: testChannel.id});
        cy.uiWaitUntilMessagePostedIncludes(message);

        // # Get the element which stores the incoming messages
        cy.get('#postListContent').within(() => {
            cy.get('.sr-only').should('have.attr', 'aria-live', 'polite').as('incomingMessage');
        });

        // * Verify incoming message is read
        cy.get('@incomingMessage').invoke('text').then((text) => {
            expect(text).contain(message);
        });
    });
});

function postMessages(testChannel, otherUser, count) {
    let lastMessage;

    for (let index = 0; index < count; index++) {
        // # Post Message as Current user
        const message = `hello from current user: ${getRandomId()}`;
        cy.postMessage(message);
        lastMessage = `hello from ${otherUser.username}: ${getRandomId()}`;
        cy.postMessageAs({sender: otherUser, message: lastMessage, channelId: testChannel.id});
    }

    return {lastMessage};
}

function performActionsToLastPost() {
    // # Take some actions on the last post
    cy.getLastPostId().then((postId) => {
        // # Add grinning reaction
        cy.clickPostReactionIcon(postId);
        cy.findAllByTestId('grinning').first().trigger('mouseover', {force: true});
        cy.get('.sprite-preview').should('be.visible');
        cy.get('.emoji-picker__preview').should('be.visible').and('have.text', ':grinning:');
        cy.findAllByTestId('grinning').first().click({force: true});
        cy.get(`#postReaction-${postId}-grinning`).should('be.visible');

        // # Add smile reaction
        cy.clickPostReactionIcon(postId);
        cy.findAllByTestId('smile').first().trigger('mouseover', {force: true});
        cy.get('.sprite-preview').should('be.visible');
        cy.get('.emoji-picker__preview').should('be.visible').and('have.text', ':smile:');
        cy.findAllByTestId('smile').first().click({force: true});
        cy.get(`#postReaction-${postId}-smile`).should('be.visible');

        // # Save the post
        cy.clickPostSaveIcon(postId);

        // # Pin the post
        cy.clickPostDotMenu(postId);
        cy.get(`#pin_post_${postId}`).click();

        cy.clickPostDotMenu(postId);
        cy.get('body').type('{esc}');
    });
}

function verifyPostLabel(elementId, username, labelSuffix) {
    // # Shift focus to the last post
    cy.get(elementId).as('lastPost').should('be.focused');

    // * Verify reader reads out the post correctly
    cy.get('@lastPost').then((el) => {
        // # Get the post time
        cy.wrap(el).find('time.post__time').invoke('text').then((time) => {
            const expectedLabel = `At ${time} ${Cypress.dayjs().format('dddd, MMMM D')}, ${username} ${labelSuffix}`;
            cy.wrap(el).should('have.attr', 'aria-label', expectedLabel);
        });
    });
}
