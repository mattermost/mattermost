// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Mention self', () => {
    let testUser;

    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl, user}) => {
            testUser = user;
            cy.visit(offTopicUrl);
        });
    });

    it('should be always highlighted', () => {
        [
            `@${testUser.username} `,
            `@${testUser.username}. `,
            `@${testUser.username}_ `,
            `@${testUser.username}- `,
            `@${testUser.username}, `,
        ].forEach((message) => {
            cy.postMessage(message);

            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).find('.mention--highlight');
            });
        });
    });

    it('should be able to click on tryAI hashtag in a message with self-mention', () => {
        // Create a message that includes both a self-mention and the #tryAI hashtag
        const message = `Hey @${testUser.username} check out #tryAI`;

        // Post the message
        cy.postMessage(message);

        // # Open RHS in recent mentions mode
        cy.findByRole('button', {name: /Recent mentions/i}).click();

        // # Get last postId
        cy.getLastPostId().as('lastPostId');

        // * Search result should return the message with the self-mention and the #tryAI hashtag
        cy.get('@lastPostId').then((postId) => {
            verifySearchResult(postId, message);
        });

        // # Verify RHS is open and contains the search results
        cy.get('.sidebar--right__title').should('contain.text', 'Search Results');

        cy.get('@lastPostId').then((postId) => {
            verifySearchResult(postId, message);
        });
    });
});

// Helper function to verify search result and click on #tryAI hashtag
function verifySearchResult(postId, fullMessage) {
    // Find the specific search item container that contains our post ID
    cy.get(`[data-testid="search-item-container"] #rhsPostMessageText_${postId}`).closest('[data-testid="search-item-container"]').within(() => {
        cy.get(`#rhsPostMessageText_${postId}`).should('have.text', `${fullMessage}`);

        // This will find the exact element containing just "#tryAI"
        cy.contains('a', '#tryAI').click({force: true});
    });
}
