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
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T4861 Show single image thumbnails in standard mode', () => {
        // # Set the messages display setting to standard i.e not compact
        cy.apiSaveMessageDisplayPreference('clean');

        // # upload an image
        const IMAGE_NAME = 'huge-image.jpg';
        cy.get('#fileUploadInput').attachFile(IMAGE_NAME);
        cy.uiWaitForFileUploadPreview();

        // # post it with a message
        const IMAGE_WITH_POST_TEXT = `image in compact display setting ${Date.now()}`;
        cy.postMessage(IMAGE_WITH_POST_TEXT);

        cy.getLastPostId().then((lastPostId) => {
            // # Get to last post's message
            cy.get(`#${lastPostId}_message`).should('exist').within(() => {
                // * Check if typed message appeared in the post
                cy.findByText(IMAGE_WITH_POST_TEXT).should('exist');

                // * Check that we don't show the image name
                cy.findByText(IMAGE_NAME).should('not.exist');

                // * Check if image appeared
                cy.findByLabelText(`file thumbnail ${IMAGE_NAME}`);

                // * Check if collapse/expand button appeared, since its an icon button without text,
                // finding it by Aria Label, as thats what screen readers will call out
                cy.findByLabelText('Toggle Embed Visibility').should('exist');

                // * Since last post was image upload, it should contain img with height property of 350px
                cy.get('img').should('exist').and('have.css', 'max-height', '350px');
            });
        });
    });
});
