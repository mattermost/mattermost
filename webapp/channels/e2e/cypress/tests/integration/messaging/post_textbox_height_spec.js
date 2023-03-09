// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit Off-Topic channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);

            // # Add two posts
            cy.postMessage('test post 1');
            cy.postMessage('test post 2');
        });
    });

    it('MM-T212 Leave a long draft in reply input box', () => {
        // # Get latest post id
        cy.getLastPostId().then((latestPostId) => {
            // # Click reply icon
            cy.clickPostCommentIcon(latestPostId);

            cy.uiGetReplyTextBox().should('have.css', 'height', '100px').invoke('height').then((height) => {
                // # Get the initial height of the textbox
                // Setting alias based on reference to element seemed to be problematic with Cypress (regression)
                // Quick hack to reference based on value
                cy.wrap(height).as('originalHeight1');
                cy.wrap(height).as('originalHeight2');
            });

            // # Write a long text in text box
            cy.uiGetReplyTextBox().type('test{shift}{enter}{enter}{enter}{enter}{enter}{enter}{enter}test');

            // # Check that input box is taller than before
            cy.get('@originalHeight1').then((originalHeight1) => {
                cy.uiGetReplyTextBox().invoke('height').should('be.gt', originalHeight1 * 2);
            });

            // # Get second latest post id
            const secondLatestPostIndex = -2;
            cy.getNthPostId(secondLatestPostIndex).then((secondLatestPostId) => {
                // # Click reply icon on the second latest post
                cy.clickPostCommentIcon(secondLatestPostId);

                // # Click again reply icon on the latest post
                cy.clickPostCommentIcon(latestPostId);

                // # Check that input box is taller again
                cy.get('@originalHeight2').then((originalHeight2) => {
                    cy.uiGetReplyTextBox().invoke('height').should('be.gt', originalHeight2 * 2);
                });
            });
        });
    });
});
