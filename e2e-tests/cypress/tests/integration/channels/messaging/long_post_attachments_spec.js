// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Messaging', () => {
    before(() => {
        // # Create new team and new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T105 Long post with multiple attachments', () => {
        // * Attachment previews/thumbnails display as expected, when viewing full or partial post':
        // # Post attachments
        postAttachments();

        // * Verify show more button
        cy.get('#showMoreButton').scrollIntoView().should('be.visible').and('have.text', 'Show more');

        // * Verify the total 4 attached items are present
        cy.getLastPostId().then((postID) => {
            cy.get(`#${postID}_message`).findByTestId('fileAttachmentList').within(() => {
                // Check if gallery is collapsed and expand it
                cy.get('.image-gallery__body').then(($body) => {
                    if ($body.hasClass('collapsed')) {
                        // Click toggle to expand the gallery
                        cy.get('.image-gallery__toggle').click();
                    }
                });
                
                // Ensure gallery is expanded
                cy.get('.image-gallery__body').should('not.have.class', 'collapsed');
                
                // Then verify we have 4 image gallery items
                cy.get('.image-gallery__item').should('have.length', 4);
                
                // * Verify the preview attachments are visible (separate assertion like working tests)
                cy.get('.image-gallery__item').should('exist').and('be.visible');
            });
        });

        // * Can click one of the attachments and cycle through the multiple attachment previews as usual:
        // # Post attachments
        postAttachments();

        // * Verify the attached items can be cycled through
        cy.getLastPostId().then((postId) => {
            // Click on the first ImageGallery item to open the modal (outside within block like working test)
            cy.get('.image-gallery__item').first().click();

            // * Verify image preview is visible
            cy.uiGetFilePreviewModal();

            // * Verify the header with the count of the file exists
            cy.uiGetHeaderFilePreviewModal().contains('1 of 4');

            for (var index = 2; index <= 4; index++) {
                // # click on right arrow to preview next attached image
                cy.get('#previewArrowRight').should('be.visible').click();

                // * Verify the header counter
                cy.uiGetHeaderFilePreviewModal().contains(`${index} of 4`);
            }

            // # Close the modal
            cy.uiCloseFilePreviewModal();
        });
    });
});

function verifyImageInPostFooter(verifyExistence = true) {
    // * Verify that the image exists or not
    cy.get('#advancedTextEditorCell').find('.file-preview').should(verifyExistence ? 'be.visible' : 'not.exist').wait(TIMEOUTS.THREE_SEC);
}

function postAttachments() {
    // # Use the robust post textbox method like the working tests
    cy.uiGetPostTextBox().should('be.visible');
    
    // Add 4 attachments to a post
    [...Array(4)].forEach(() => {
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile('small-image.png');
    });

    // # verify the attachment at the footer
    verifyImageInPostFooter();

    // # Copy and paste the text below into the message box and post
    cy.fixture('long_text_post.txt', 'utf-8').then((text) => {
        cy.uiGetPostTextBox().then((textbox) => {
            textbox.val(text);
        }).type(' {backspace}{enter}');
    });
}
