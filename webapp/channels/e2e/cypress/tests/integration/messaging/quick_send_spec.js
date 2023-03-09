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
        // # Login as test user and visit Off-Topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);
            cy.postMessage('hello');
        });
    });

    it('MM-T3309 Posts do not change order when being sent quickly', () => {
        // # Build a message and send
        for (let i = 9; i >= 0; i--) {
            const message = i + '{enter}';
            cy.uiGetPostTextBox().type(message, {delay: 0});
        }

        for (let i = 10; i > 0; i--) {
            cy.getNthPostId(-i).then((postId) => {
                // * Check if the text is the correct one
                cy.get(`#postMessageText_${postId} > p`).should('have.text', String(i - 1));
            });
        }
    });
});
