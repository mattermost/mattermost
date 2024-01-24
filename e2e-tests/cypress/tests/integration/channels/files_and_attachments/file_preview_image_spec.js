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

describe('Upload Files - Image', () => {
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

    it('MM-T2264_1 - JPG', () => {
        const properties = {
            filePath: 'mm_file_testing/Images/JPG.jpg',
            fileName: 'JPG.jpg',
            originalWidth: 400,
            originalHeight: 479,
            mimeType: 'image/jpg',
        };

        testImage(properties);
    });

    it('MM-T2264_2 - PNG', () => {
        const properties = {
            filePath: 'mm_file_testing/Images/PNG.png',
            fileName: 'PNG.png',
            originalWidth: 400,
            originalHeight: 479,
            mimeType: 'image/png',
        };

        testImage(properties);
    });

    it('MM-T2264_3 - BMP', () => {
        const properties = {
            filePath: 'mm_file_testing/Images/BMP.bmp',
            fileName: 'BPM.bmp',
            originalWidth: 400,
            originalHeight: 479,
            mimeType: 'image/bmp',
        };

        testImage(properties);
    });

    it('MM-T2264_4 - GIF', () => {
        const properties = {
            filePath: 'mm_file_testing/Images/GIF.gif',
            fileName: 'GIF.gif',
            originalWidth: 500,
            originalHeight: 500,
            mimeType: 'image/gif',
        };

        testImage(properties);
    });

    it('MM-T2264_5 - TIFF', () => {
        const properties = {
            filePath: 'mm_file_testing/Images/TIFF.tif',
            fileName: 'TIFF.tif',
            originalWidth: 400,
            originalHeight: 479,
            mimeType: 'image/tiff',
        };

        testImage(properties);
    });

    it('MM-T2264_6 - PSD', () => {
        const properties = {
            filePath: 'mm_file_testing/Images/PSD.psd',
            fileName: 'PSD.psd',
            originalWidth: 400,
            originalHeight: 479,
            mimeType: 'application/psd',
        };

        testImage(properties);
    });

    it('MM-T2264_7 - WEBP', () => {
        const properties = {
            filePath: 'mm_file_testing/Images/WEBP.webp',
            fileName: 'WEBP.webp',
            originalWidth: 640,
            originalHeight: 426,
            mimeType: 'image/webp',
        };

        testImage(properties);
    });
});

function testImage(properties) {
    const {fileName, originalWidth, originalHeight} = properties;
    const aspectRatio = originalWidth / originalHeight;

    // # Post any message
    cy.postMessage(fileName);

    // # Post an image in center channel
    attachFile(properties);

    // # Wait until file upload is complete then submit
    waitUntilUploadComplete();
    cy.uiGetPostTextBox().clear().type('{enter}');
    cy.wait(TIMEOUTS.FIVE_SEC);

    // # Open file preview
    cy.uiGetFileThumbnail(fileName).click();

    // * Verify that the preview modal open up
    cy.uiGetFilePreviewModal().as('filePreviewModal');

    cy.get('@filePreviewModal').uiGetContentFilePreviewModal().find('img').should((img) => {
        // * Image aspect ratio is maintained
        expect(img.width() / img.height()).to.be.closeTo(aspectRatio, 0.01);
    });

    // * Download button should exist
    cy.get('@filePreviewModal').uiGetDownloadFilePreviewModal().then((downloadLink) => {
        expect(downloadLink.attr('download')).to.equal(fileName);

        const fileAttachmentURL = downloadLink.attr('href');

        // * Verify that download link has correct name
        downloadAttachmentAndVerifyItsProperties(fileAttachmentURL, fileName, 'attachment');
    });

    // # Close modal
    cy.uiCloseFilePreviewModal();
}
