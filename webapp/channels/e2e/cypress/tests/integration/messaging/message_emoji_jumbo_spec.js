// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging @emoji

const normalSize = '21px';
const jumboSize = '32px';

const testCases = [
    {message: 'This is a normal reply with emoji :smile:', emojiSize: normalSize},
    {message: ':smile:', emojiSize: jumboSize},
    {message: ':smile: :yum:', emojiSize: jumboSize},
];

function verifyLastPostStyle(expectedSize) {
    //  # Get Last Post ID
    cy.getLastPostId().then((postId) => {
        const postMessageTextId = `#rhsPostMessageText_${postId}`;

        // # Get Each Emoji from Reply Window RHS for the postId
        cy.get(`#rhsContainer .post-right__content ${postMessageTextId} span.emoticon`).each(($el) => {
            cy.wrap($el).as('message');

            // * Verify the size of the emoji
            cy.get('@message').should('have.css', 'height', expectedSize).and('have.css', 'width', expectedSize);
        });
    });
}

describe('Message', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);
        });
    });

    it('MM-T162 Emojis show as jumbo in reply thread', () => {
        // # Post a message
        const messageText = 'This is a test message';
        cy.postMessage(messageText);

        // # Get Last Post ID
        cy.getLastPostId().then((postId) => {
            // # Mouseover the post and click post comment icon.
            cy.clickPostCommentIcon(postId);

            testCases.forEach((testCase) => {
                // # Post a reply
                cy.postMessageReplyInRHS(testCase.message);

                // * Verify the size of the emoji
                verifyLastPostStyle(testCase.emojiSize);
            });
        });
    });
});
