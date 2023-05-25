// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging @markdown

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            cy.postMessage('hello');
        });
    });

    it('MM-T189 Markdown quotation paragraphs', () => {
        const messageParts = ['this is', 'really', 'three quote lines'];

        // # Post message to use
        cy.uiGetPostTextBox().clear().type('>' + messageParts[0]).type('{shift}{enter}{enter}');
        cy.uiGetPostTextBox().type('>' + messageParts[1]).type('{shift}{enter}{enter}');
        cy.uiGetPostTextBox().type('>' + messageParts[2]).type('{enter}');

        var firstPartLeft;
        cy.getLastPostId().then((postId) => {
            // * There is only one blockquote, and therefore only one Quote icon
            cy.get(`#postMessageText_${postId} > blockquote`).should('have.length', 1);

            // * There are three distinct paragraphs, and therefore the three of them are separated by a space
            cy.get(`#postMessageText_${postId} > blockquote > p`).should('have.length', 3);
            cy.get(`#postMessageText_${postId} > blockquote > p`).each((el, i) => {
                // * Each paragraph contains the content we put on the message
                expect(messageParts[i]).equals(el.html());

                // # We save the alignment of the first paragraph
                if (i === 0) {
                    firstPartLeft = el[0].getBoundingClientRect().left;
                }

                // * All paragraph are aligned on their left border
                expect(firstPartLeft).equals(el[0].getBoundingClientRect().left);
            });
        });
    });
});
