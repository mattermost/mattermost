// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging @benchmark

import {reportBenchmarkResults} from '../../../utils/benchmark';

describe('Message', () => {
    before(() => {
        // # Create new team and new user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('Current user posting message in empty channel', () => {
        // # Wait for posts to load
        cy.get('#postListContent', {timeout: 10000}).should('be.visible');

        // # Reset selector measurements
        cy.window().then((win) => {
            win.resetTrackedSelectors();

            // # Post message "One"
            cy.postMessage('One');

            cy.getLastPostId().then((postId) => {
                const divPostId = `#postMessageText_${postId}`;

                // * Check that the message was created
                cy.get(divPostId).find('p').should('have.text', 'One');

                reportBenchmarkResults(cy, win);
            });
        });
    });

    it('Typing one character into create post textbox', () => {
        // # Wait for posts to load
        cy.get('#postListContent', {timeout: 10000}).should('be.visible');

        // # Reset selector measurements
        cy.window().then((win) => {
            win.resetTrackedSelectors();

            // # Push a character key such as "A"
            cy.uiGetPostTextBox().type('A').then(() => {
                reportBenchmarkResults(cy, win);
            });
        });
    });
});
