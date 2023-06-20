// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);

            // # Post a new message to ensure there will be a post to click on
            cy.postMessage('Hello ' + Date.now());
        });
    });

    it('MM-T209 Input box on reply thread can expand', () => {
        const maxReplyCount = 15;
        const halfViewportHeight = Cypress.config('viewportHeight') / 2;
        const padding = 8;
        const postCreateContainerDefaultHeight = 188;
        const replyTextBoxDefaultHeight = 100;
        const postCreateContainerClassName = 'post-create__container';
        const replyTextBoxId = 'reply_textbox';
        let newLinesCount;

        // # Click "Reply"
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
        });

        // # Post several replies and verify last reply
        cy.get(`#${replyTextBoxId}`).clear().should('be.visible').as('replyTextBox');
        for (let i = 1; i <= maxReplyCount; i++) {
            cy.postMessageReplyInRHS(`post ${i}`);
        }
        verifyLastReply(maxReplyCount);

        // # Get post create container and reply text box
        cy.document().then((doc) => {
            const postCreateContainer = doc.getElementsByClassName(postCreateContainerClassName)[0];
            const replyTextBox = doc.getElementById(replyTextBoxId);

            // * Check if post create container has default offset height and less than 50% of viewport height
            expect(postCreateContainer.offsetHeight).to.eq(postCreateContainerDefaultHeight).and.lessThan(halfViewportHeight);

            // * Check if reply text box has default offset height and less than post create container default offset height
            expect(replyTextBox.offsetHeight).to.eq(replyTextBoxDefaultHeight).and.lessThan(postCreateContainerDefaultHeight);
        });

        // # Enter new lines into RHS so that box should reach max height, verify last reply, and verify heights
        newLinesCount = 25;
        enterNewLinesAndVerifyLastReplyAndHeights(newLinesCount, maxReplyCount, postCreateContainerClassName, replyTextBoxId, padding, halfViewportHeight, postCreateContainerDefaultHeight);

        // # Enter more new lines into RHS, verify last reply, and verify heights
        newLinesCount *= 2;
        enterNewLinesAndVerifyLastReplyAndHeights(newLinesCount, maxReplyCount, postCreateContainerClassName, replyTextBoxId, padding, halfViewportHeight, postCreateContainerDefaultHeight);

        // # Get first reply and scroll into view
        cy.getNthPostId(-maxReplyCount).then((replyId) => {
            cy.get(`#postMessageText_${replyId}`).scrollIntoView();
            cy.wait(TIMEOUTS.HALF_SEC);
        });

        // # Type new message to reply text box and verify last reply
        cy.get('@replyTextBox').type('new message');
        verifyLastReply(maxReplyCount);
    });

    function enterNewLinesAndVerifyLastReplyAndHeights(newLinesCount, maxReplyCount, postCreateContainerClassName, replyTextBoxId, padding, halfViewportHeight, postCreateContainerDefaultHeight) {
        const newLines = '{shift}{enter}'.repeat(newLinesCount);
        cy.get('@replyTextBox').type(newLines);
        verifyLastReply(maxReplyCount);
        verifyHeights(postCreateContainerClassName, replyTextBoxId, padding, halfViewportHeight, postCreateContainerDefaultHeight);
    }

    function verifyLastReply(maxReplyCount) {
        // * Check last reply is visible
        cy.getLastPostId().then((replyId) => {
            cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', `post ${maxReplyCount}`);
        });
    }

    function verifyHeights(postCreateContainerClassName, replyTextBoxId, padding, halfViewportHeight, postCreateContainerDefaultHeight) {
        // # Get post create container and reply text box
        cy.document().then((doc) => {
            const postCreateContainer = doc.getElementsByClassName(postCreateContainerClassName)[0];
            const replyTextBox = doc.getElementById(replyTextBoxId);

            // * Check if post create container offset height is 50% of viewport height
            expect(postCreateContainer.offsetHeight - padding).to.eq(halfViewportHeight);

            // * Check if reply text box offset height is greater than post create container default height
            expect(replyTextBox.offsetHeight).to.be.greaterThan(postCreateContainerDefaultHeight);

            // * Check if reply text box height attribute is greater than reply text box offset height
            cy.get(`#${replyTextBoxId}`).should('have.attr', 'height').then((height) => {
                expect(Number(height)).to.be.greaterThan(replyTextBox.offsetHeight);
            });
        });
    }
});
