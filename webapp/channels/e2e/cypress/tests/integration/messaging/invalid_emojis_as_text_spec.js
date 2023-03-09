// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging @emoji

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T167 Terms that are not valid emojis render as plain text', () => {
        // # Post message to use
        cy.postMessage(':pickle:');

        // * Post contains the text
        cy.getLastPost().should('contain', ':pickle:');

        // # Post message to use
        cy.postMessage('on Mon Jun 03 16:15:11 +0000 2019');

        // * Post contains the text
        cy.getLastPost().should('contain', 'on Mon Jun 03 16:15:11 +0000 2019');
    });
});
