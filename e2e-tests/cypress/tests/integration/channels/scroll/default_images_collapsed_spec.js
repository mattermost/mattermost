// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod

describe('Scroll', () => {
    before(() => {
        // # Create new team and new user and visit Town Square channel
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            // # Switch the settings for the test user to have images collapsed by default
            cy.apiSaveCollapsePreviewsPreference('true');

            cy.visit(offTopicUrl);

            // # Post at least 10 messages in a channel
            Cypress._.times(10, (index) => cy.postMessage(index));
        });
    });

    it('MM-T2370 Default images to collapsed', () => {
        const filename = 'huge-image.jpg';

        // # Post an image in center channel
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);

        cy.get('.post-image').should('be.visible');

        cy.uiGetPostTextBox().clear().type('{enter}');

        // * Observe image preview is collapsed
        cy.uiGetFileThumbnail(filename).should('not.exist');

        // # Save height of the last post
        cy.getLastPost().then((lastPost) => {
            cy.wrap(parseInt(lastPost[0].clientHeight, 10)).as('lastPostHeight');
        });

        // # Refresh the browser
        cy.reload();

        // * Verify that the last post is still the same after reload
        cy.getLastPost().then((lastPost) => {
            cy.get('@lastPostHeight').then((lastPostHeight) => {
                expect(parseInt(lastPost[0].clientHeight, 10)).to.equal(lastPostHeight);
            });
        });

        // * Observe image preview is collapsed after reloading the page
        cy.uiGetFileThumbnail(filename).should('not.exist');

        // # Sanity check that it's visible when collapsed preview is disabled
        cy.apiSaveCollapsePreviewsPreference('false');
        cy.reload();
        cy.uiGetFileThumbnail(filename).should('be.visible');
    });
});
