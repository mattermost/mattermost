// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

const TIMEOUTS = require('../../../fixtures/timeouts');

describe('Message Reply', () => {
    let mainChannel;
    let otherChannel;
    let rootId;

    before(() => {
        // # Create main channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            mainChannel = channel;

            // # Create other channel
            cy.apiCreateChannel(team.id, 'other', 'other').then(({channel: newChannel}) => {
                otherChannel = newChannel;
            });

            // # Visit main channel
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T2132 - Message sends: just text', () => {
        // # Type `Hello` in center message box
        const msg = 'Hello';
        cy.uiGetPostTextBox().type(msg);

        // # Press `Enter`
        cy.uiGetPostTextBox().type('{enter}');

        // * Message displays in center
        cy.getLastPostId().then((postId) => {
            rootId = postId;
            cy.get(`#postMessageText_${postId}`).should('be.visible').and('have.text', msg);
        });
    });

    it('MM-T2133 - Reply arrow opens RHS with Reply button disabled until text entered', () => {
        // # Click on the `...` menu icon and click on `Reply`
        cy.uiClickPostDropdownMenu(rootId, 'Reply', 'CENTER');

        // * RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // * Reply button is disabled
        cy.uiGetReply().should('be.disabled');

        // # Type a character in the comment box
        cy.uiGetReplyTextBox().type('A');

        // * Reply button is not disabled
        cy.uiGetReply().should('not.be.disabled');

        // # Clear comment box
        cy.uiGetReplyTextBox().clear();

        // # Close RHS
        cy.uiCloseRHS();
    });

    it('MM-T2134 - Reply to message displays in RHS and center and shows reply count', () => {
        // # Open RHS comment menu
        cy.clickPostCommentIcon(rootId);

        const msg = 'reply1';

        // # Type message
        cy.uiGetReplyTextBox().type(msg);

        // # Post reply
        cy.uiReply();

        cy.getLastPostId().then((replyId) => {
            // * Message displays in center
            cy.get(`#post_${replyId}`).within(() => {
                cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', msg);
            });

            // * Message displays in RHS
            cy.get(`#rhsPost_${replyId}`).within(() => {
                cy.get(`#rhsPostMessageText_${replyId}`).should('be.visible').and('have.text', msg);
            });

            // * Reply count is visible and shows expected value
            cy.get(`#CENTER_commentIcon_${rootId} .post-menu__comment-count`).should('be.visible').and('have.text', '1');
        });

        // # Close RHS
        cy.uiCloseRHS();
    });

    it('MM-T2135 - Can open reply thread from reply count arrow and reply', () => {
        // # Click reply icon
        cy.clickPostCommentIcon(rootId);

        const msg = 'reply2';

        // # Type message
        cy.uiGetReplyTextBox().type(msg);

        // # Press `Enter`
        cy.uiGetReplyTextBox().type('{enter}');

        cy.getLastPostId().then((replyId) => {
            // * Message displays in center
            cy.get(`#post_${replyId}`).within(() => {
                cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', msg);
            });

            // * Message displays in RHS
            cy.get(`#rhsPost_${replyId}`).within(() => {
                cy.get(`#rhsPostMessageText_${replyId}`).should('be.visible').and('have.text', msg);
            });
        });

        // # Close RHS
        cy.uiCloseRHS();
    });

    it('MM-T2136 - Reply in RHS with different channel open in center', () => {
        // # Click on the `...` menu icon and click on `Reply`
        cy.uiClickPostDropdownMenu(rootId, 'Reply', 'CENTER');

        // # Switch to a different channel
        cy.get(`#sidebarItem_${otherChannel.name}`).click().wait(TIMEOUTS.FIVE_SEC);

        const msg = 'reply3';

        // # Type message
        cy.uiGetReplyTextBox().type(msg);

        // # Post reply
        cy.uiReply().wait(TIMEOUTS.HALF_SEC);

        // * Center channel has not changed
        cy.get('#channelHeaderTitle').should('contain', otherChannel.display_name);

        // * Main channel is not unread
        cy.get(`#sidebarItem_${mainChannel.name}`).should('not.have.class', 'unread-title');

        // # Close RHS
        cy.uiCloseRHS();
    });
});
