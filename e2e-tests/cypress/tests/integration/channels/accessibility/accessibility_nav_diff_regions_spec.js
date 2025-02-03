// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @accessibility

import {getRandomId} from '../../../utils';

function postMessages(testChannel, otherUser, count) {
    for (let index = 0; index < count; index++) {
        // # Post Message as Current user
        const message = `hello from current user: ${getRandomId()}`;
        cy.postMessage(message);
        const otherMessage = `hello from ${otherUser.username}: ${getRandomId()}`;
        cy.postMessageAs({sender: otherUser, message: otherMessage, channelId: testChannel.id});
    }
}

function verifyNavSupport(element, label, tabOrder) {
    cy.get(element).
        should('have.attr', 'aria-label', label).
        and('have.attr', 'data-a11y-sort-order', tabOrder).
        and('have.class', 'a11y__region a11y--active');
}

describe('Verify Quick Navigation support across different regions in the app', () => {
    let otherUser;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testChannel = channel;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id).then(() => {
                        // # Login as test user, visit test channel and post few messages
                        cy.apiLogin(user);
                        cy.visit(`/${team.name}/channels/${testChannel.name}`);

                        // # Post few messages
                        postMessages(testChannel, otherUser, 5);
                    });
                });
            });
        });
    });

    it('MM-T1460_1 Verify Navigation Support in Post List & Post Input', () => {
        // # Shift focus to the last post
        cy.uiGetPostTextBox().focus().tab({shift: true}).tab({shift: true});
        cy.get('body').type('{uparrow}{downarrow}');

        // * Verify post region reads out correctly
        verifyNavSupport('#virtualizedPostListContent > div', 'message list main region', '1');

        // # Shift focus to the post input
        cy.uiGetPostTextBox().focus().tab().tab({shift: true});

        // * Verify post input region reads out correctly
        verifyNavSupport('#advancedTextEditorCell', 'message input complimentary region', '2');
    });

    it('MM-T1460_3 Verify Navigation Support in RHS Post List & RHS Post Input', () => {
        // # Open RHS and reply
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
            const replyMessage = 'A reply to an older post';
            cy.postMessageReplyInRHS(replyMessage);
        });

        // * Verify post message in RHS
        cy.uiGetRHS().within(() => {
            // # Shift the focus to the last post
            cy.uiGetReplyTextBox().focus().tab({shift: true}).type('{uparrow}');

            // * Verify post region on RHS reads out correctly
            verifyNavSupport('.post-right__content', 'message details complimentary region', '3');

            // # Shift the focus to the RHS input
            cy.uiGetReplyTextBox().focus().tab().tab({shift: true});

            // * Verify post input on RHS reads out correctly
            cy.get('#advancedTextEditorCell').
                should('have.attr', 'aria-label', 'message input complimentary region').
                and('have.attr', 'data-a11y-sort-order', '2').
                and('have.class', 'a11y__region');
            cy.uiGetReplyTextBox().
                should('have.class', 'a11y--active a11y--focused');
        });
    });

    it('MM-T1460_5 Verify Navigation Support in LHS Sidebar', () => {
        // # Change the focus to Main Menu button
        cy.uiGetLHSAddChannelButton().focus().tab({shift: true}).tab();

        // # Change the focus to the LHS sidebar
        cy.focused().tab();

        // * Verify nav support in LHS channel navigator
        verifyNavSupport('#lhsNavigator', 'channel navigator region', '6');

        // # Change the focus to the LHS sidebar
        cy.focused().tab().tab().tab().tab();

        // * Verify nav support in LHS sidebar
        verifyNavSupport('#sidebar-left', 'channel sidebar region', '7');
    });

    it('MM-T1460_6 Verify Navigation Support in Channel Header', () => {
        // # Change the focus to Main Menu button
        cy.get('#toggleFavorite').focus().tab({shift: true}).tab();

        // * Verify nav support in LHS sidebar header
        verifyNavSupport('#channel-header', 'channel header region', '8');
    });

    it('MM-T1460_8 Verify Navigation Support in Search Results', () => {
        // # Search for some text
        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().should('be.visible').first().type('hello {enter}');

        // # Change the focus to search results
        cy.get('#searchContainer').within(() => {
            cy.get('button.sidebar--right__expand').focus().tab({shift: true}).tab();
            cy.focused().tab().tab().tab().tab();
        });
        cy.get('body').type('{downarrow}{uparrow}');

        // * Verify nav support in Search Results Container
        verifyNavSupport('#search-items-container', 'Search Results complimentary region', '3');
    });
});
