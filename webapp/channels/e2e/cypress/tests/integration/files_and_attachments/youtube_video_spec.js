// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @files_and_attachments

describe('YouTube Video', () => {
    before(() => {
        // # Enable Link Previews
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLinkPreviews: true,
            },
        });

        // # Create new team and new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T2258 YouTube Video play, collapse', () => {
        // # Post message
        cy.postMessage('https://www.youtube.com/watch?v=gLNmtUEvI5A');
        cy.getLastPost().within(() => {
            // # Click play button
            cy.get('.play-button').click();

            // * Video should be loaded in the iframe
            cy.get('.video-div > iframe').should('exist');

            // # Collapse video
            cy.get('.post__embed-visibility').click();

            // * Embed container should not exist
            cy.get('.post__embed-container').should('not.exist');

            // # Expand video
            cy.get('.post__embed-visibility').click();

            // * Play button should exist
            cy.get('.play-button').should('exist');

            // * Video should not be played in the iframe
            cy.get('.video-div > iframe').should('not.exist');
        });
    });
});
