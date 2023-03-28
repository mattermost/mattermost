// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod

describe('Upload Files', () => {
    before(() => {
        // # Create new team and new user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T307 Cancel a file upload', () => {
        const hugeImage = 'huge-image.jpg';

        // # Intercept response of /files endpoint
        cy.intercept('POST', '/api/v4/files', {
            body: {client_ids: [], file_infos: []},
        });

        // # Post an image in center channel
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(hugeImage);

        // * Verify thumbnail of ongoing file upload
        cy.get('.file-preview__container').should('be.visible').within(() => {
            cy.get('.post-image__thumbnail').should('be.visible');
            cy.findByText(hugeImage).should('be.visible');
            cy.findByText('Processing...').should('be.visible');
        });

        // # Click the `X` on the file attachment thumbnail
        cy.get('.file-preview__remove > .icon').click();

        // * Check if thumbnail disappears
        cy.get('.post-image').should('not.exist');
        cy.findByLabelText('file thumbnail').should('not.exist');
    });
});
