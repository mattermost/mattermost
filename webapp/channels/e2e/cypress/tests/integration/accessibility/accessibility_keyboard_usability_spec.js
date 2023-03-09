// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @accessibility

import {getRandomId} from '../../utils';

function postMessages(testChannel, otherUser, count) {
    for (let index = 0; index < count; index++) {
        // # Post Message as Current user
        const message = `hello from current user: ${getRandomId()}`;
        cy.postMessage(message);
        const otherMessage = `hello from ${otherUser.username}: ${getRandomId()}`;
        cy.postMessageAs({sender: otherUser, message: otherMessage, channelId: testChannel.id});
    }
}

describe('Verify Accessibility keyboard usability across different regions in the app', () => {
    const count = 5;
    let testUser;
    let otherUser;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testChannel = channel;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id).then(() => {
                        // # Login as test user, visit test channel and post few messages
                        cy.apiLogin(user);
                        cy.visit(`/${team.name}/channels/${testChannel.name}`);
                    });
                });
            });
        });
    });

    it('MM-T1513_2 Verify Keyboard support in Search Results', () => {
        // # Post few messages
        postMessages(testChannel, otherUser, count);

        // # Search for a term
        cy.get('#searchBox').typeWithForce('hello').typeWithForce('{enter}');

        // # Change the focus to search results
        cy.get('#searchContainer').within(() => {
            cy.get('button.sidebar--right__expand').focus().tab({shift: true}).tab();
            cy.focused().tab().tab().tab().tab();
        });
        cy.get('body').type('{downarrow}{uparrow}');

        // # Use down arrow keys and verify if results are highlighted sequentially
        for (let index = 0; index < count; index++) {
            cy.get('#search-items-container').children('.search-item__container').eq(index).then(($el) => {
                // * Verify search result is highlighted
                cy.get($el).find('.post').should('have.class', 'a11y--active a11y--focused');
                cy.get('body').type('{downarrow}');
            });
        }

        // # Use up arrow keys and verify if results are highlighted sequentially
        for (let index = count; index > 0; index--) {
            cy.get('#search-items-container').children('.search-item__container').eq(index).then(($el) => {
                // * Verify search result is highlighted
                cy.get($el).find('.post').should('have.class', 'a11y--active a11y--focused');
                cy.get('body').type('{uparrow}');
            });
        }
    });

    it('MM-T1513_1 Verify Keyboard support in RHS', () => {
        // # Post Message as Current user
        const message = `hello from ${testUser.username}: ${getRandomId()}`;
        cy.postMessage(message);

        // # Post few replies on RHS
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
            cy.get('#rhsContainer').should('be.visible');

            for (let index = 0; index < count; index++) {
                const replyMessage = `A reply ${getRandomId()}`;
                cy.postMessageReplyInRHS(replyMessage);
                const messageFromOther = `reply from ${otherUser.username}: ${getRandomId()}`;
                cy.postMessageAs({sender: otherUser, message: messageFromOther, channelId: testChannel.id, rootId: postId});
            }
        });

        // * Verify that the highlight order is in the reverse direction in RHS
        cy.get('#rhsContainer .post-right__content').should('have.attr', 'data-a11y-order-reversed', 'true').and('have.attr', 'data-a11y-focus-child', 'true');

        // # Change the focus to the last post
        cy.get('#rhsContainer').within(() => {
            cy.uiGetReplyTextBox().focus().tab({shift: true});
        });
        cy.get('body').type('{uparrow}{downarrow}');

        // # Use up arrow keys and verify if results are highlighted sequentially
        const total = (count * 2) + 1; // # total number of expected posts in RHS
        let row = total - 1; // # the row index which should be focused

        for (let index = count; index > 0; index--) {
            cy.get('#rhsContainer .post-right-comments-container .post').eq(row).then(($el) => {
                // * Verify search result is highlighted
                cy.get($el).should('have.class', 'a11y--active a11y--focused');
                cy.get('body').type('{uparrow}');
            });
            row--;
        }

        // # Use down arrow keys and verify if posts are highlighted sequentially
        for (let index = count; index > 0; index--) {
            cy.get('#rhsContainer .post-right-comments-container .post').eq(row).then(($el) => {
                // * Verify search result is highlighted
                cy.get($el).should('have.class', 'a11y--active a11y--focused');
                cy.get('body').type('{downarrow}');
            });
            row++;
        }
    });

    it('MM-T1499 Verify Screen reader should not switch to virtual cursor mode', () => {
        // # Open RHS
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);

            // * Verify Screen reader should not switch to virtual cursor mode. This is handled by adding a role=application attribute
            const regions = ['#sidebar-left', '#rhsContainer .post-right__content', '.search__form', '#advancedTextEditorCell'];
            regions.forEach((region) => {
                cy.get(region).should('have.attr', 'role', 'application');
            });
            cy.get(`#post_${postId}`).children('.post__content').eq(0).should('have.attr', 'role', 'application');
            cy.get(`#rhsPost_${postId}`).children('.post__content').eq(0).should('have.attr', 'role', 'application');
        });
    });
});
