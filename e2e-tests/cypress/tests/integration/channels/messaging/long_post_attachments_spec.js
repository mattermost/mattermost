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
            cy.get(`#${postID}_message`).findByTestId('fileAttachmentList').children().should('have.length', '4');

            // * Verify the preview attachment are present
            [...Array(4)].forEach((value, index) => {
                cy.get(`#${postID}_message`).findByTestId('fileAttachmentList').children().eq(index).
                    find('.post-image__name').contains('small-image.png').should('exist');
            });
        });

        // * Can click one of the attachments and cycle through the multiple attachment previews as usual:
        // # Post attachments
        postAttachments();

        // * Verify the attached items can be cycled through
        cy.getLastPostId().then((postId) => {
            cy.get(`#${postId}_message`).within(() => {
                cy.uiOpenFilePreviewModal();
            });

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
    // Add 4 attachments to a post
    [...Array(4)].forEach(() => {
        cy.get('#fileUploadInput').attachFile('small-image.png');
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
