// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getAdminAccount} from '../../../support/env';

describe('Messaging', () => {
    const admin = getAdminAccount();
    let testChannelId;
    let testChannelUrl;

    before(() => {
        // # Login as test user and visit test channel
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            testChannelId = out.channel.id;
            testChannelUrl = out.channelUrl;
            cy.visit(testChannelUrl);
        });
    });

    // if the root post is deleted Drafts under that post from all users are deleted.
    it('MM-T113 Delete a Message during reply, other user sees "(message deleted)"', () => {
        const message = 'aaa';
        const draftMessage = 'draft';

        // # Type message to use
        cy.postMessageAs({sender: admin, message, channelId: testChannelId});

        // # Click Reply button
        cy.clickPostCommentIcon();

        // # Write message on reply box
        cy.uiGetReplyTextBox().type(draftMessage);

        // # Remove message from the other user
        cy.getLastPostId().then((postId) => {
            cy.externalRequest({user: admin, method: 'DELETE', path: `posts/${postId}`});

            // # Wait for the message to be deleted
            cy.wait(TIMEOUTS.HALF_SEC);

            // * Aria labels should not contain original message
            cy.get(`#post_${postId}, #rhsPost_${postId}`).each((el) => {
                cy.wrap(el).
                    should('have.attr', 'aria-label').
                    and('not.contain', message);
            });

            // * The message should not have been sent
            cy.uiGetRHS().find('.post__content').each((content) => {
                cy.wrap(content).findByText(draftMessage).should('not.exist');
            });

            // # Change to the other user and go to test channel
            cy.apiAdminLogin();
            cy.visit(testChannelUrl);

            // * Post should not exist
            cy.get(`#post_${postId}`).should('not.exist');
        });
    });
});
