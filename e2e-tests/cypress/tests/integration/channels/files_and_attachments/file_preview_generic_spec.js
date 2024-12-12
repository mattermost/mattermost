// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @files_and_attachments

import * as TIMEOUTS from '../../../fixtures/timeouts';

import {
    attachFile,
    downloadAttachmentAndVerifyItsProperties,
    interceptFileUpload,
    waitUntilUploadComplete,
} from './helpers';

describe('Upload Files - Generic', () => {
    before(() => {
        // # Create new team and new user and visit test channel
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            cy.visit(channelUrl);
            cy.postMessage('hello');
        });
    });

    beforeEach(() => {
        interceptFileUpload();
    });

    it('MM-T3824_1 - PDF', () => {
        const properties = {
            filePath: 'mm_file_testing/Documents/PDF.pdf',
            fileName: 'PDF.pdf',
            mimeType: 'application/pdf',
            type: 'pdf',
        };
        testGenericFile(properties);
    });

    it('MM-T3824_2 - Excel', () => {
        const properties = {
            filePath: 'mm_file_testing/Documents/Excel.xlsx',
            fileName: 'Excel.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            type: 'excel',
        };
        testGenericFile(properties);
    });

    it('MM-T3824_3 - PPT', () => {
        const properties = {
            filePath: 'mm_file_testing/Documents/PPT.pptx',
            fileName: 'PPT.pptx',
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            type: 'ppt',
        };
        testGenericFile(properties);
    });

    it('MM-T3824_4 - Word', () => {
        const properties = {
            filePath: 'mm_file_testing/Documents/Word.docx',
            fileName: 'Word.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            type: 'word',
        };
        testGenericFile(properties);
    });

    it('MM-T3824_5 - Text', () => {
        const properties = {
            filePath: 'mm_file_testing/Documents/Text.txt',
            fileName: 'Text.txt',
            mimeType: 'txt/plain',
            type: 'text',
        };
        testGenericFile(properties);
    });
});

function testGenericFile(properties) {
    const {fileName, type} = properties;

    // # Post any message
    cy.postMessage(fileName);

    // # Post an image in center channel
    attachFile(properties);

    // # Wait until file upload is complete then submit
    waitUntilUploadComplete();
    cy.uiGetPostTextBox().clear().type('{enter}');
    cy.wait(TIMEOUTS.ONE_SEC);

    // # Open file preview
    cy.uiGetFileThumbnail(fileName).click();

    // * Verify that the preview modal open up
    cy.uiGetFilePreviewModal().as('filePreviewModal');
    switch (type) {
    case 'text':
        cy.get('@filePreviewModal').get('code').should('exist');
        break;
    case 'pdf':
        cy.get('@filePreviewModal').get('canvas').should('have.length', 10);
        break;
    default:
    }

    // * Download button should exist
    cy.get('@filePreviewModal').uiGetDownloadFilePreviewModal().then((downloadLink) => {
        cy.wrap(downloadLink).parent().should('have.attr', 'download', fileName).then((link) => {
            const fileAttachmentURL = link.attr('href');

            // * Verify that download link has correct name
            downloadAttachmentAndVerifyItsProperties(fileAttachmentURL, fileName, 'attachment');
        });
    });

    // # Close modal
    cy.uiCloseFilePreviewModal();
}
