// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

// # Other user posts a few messages so that the first message is hidden
export function postListOfMessages({sender, channelId, numberOfMessages = 30}) {
    Cypress._.times(numberOfMessages, (postIndex) => {
        cy.postMessageAs({sender, message: `Other users p-${postIndex}`, channelId});
    });
}

// # Scroll above the last few messages
export function scrollCurrentChannelFromTop(listPercentageRatio) {
    cy.get('div.post-list__dynamic', {timeout: TIMEOUTS.ONE_SEC}).should('be.visible').
        scrollTo(0, listPercentageRatio, {duration: TIMEOUTS.ONE_SEC}).
        wait(TIMEOUTS.ONE_SEC);
}

export function deletePostAndVerifyScroll(postId, options) {
    let firstPostBeforeScroll;
    let lastPostBeforeScroll;

    // # Get the text of the first visible post
    cy.get('.post-message__text:visible').first().then((postMessage) => {
        firstPostBeforeScroll = postMessage.text();
    });

    // # Get the text of the last visible post
    cy.get('.post-message__text:visible').last().then((postMessage) => {
        lastPostBeforeScroll = postMessage.text();
    });

    // # Remove the message
    cy.externalRequest({...options, method: 'DELETE', path: `posts/${postId}`});

    // # Wait for the message to be deleted
    cy.wait(TIMEOUTS.ONE_SEC);

    // * Verify the first post is the same after the deleting
    cy.get('.post-message__text:visible').first().then((firstPostAfterScroll) => {
        expect(firstPostAfterScroll.text()).equal(firstPostBeforeScroll);
    });

    // * Verify the last post is the same after the deleting
    cy.get('.post-message__text:visible').last().then((lastPostAfterScroll) => {
        expect(lastPostAfterScroll.text()).equal(lastPostBeforeScroll);
    });
}
