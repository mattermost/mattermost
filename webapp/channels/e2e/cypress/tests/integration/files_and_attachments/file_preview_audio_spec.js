// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @files_and_attachments

import * as TIMEOUTS from '../../fixtures/timeouts';

import {
    attachFile,
    downloadAttachmentAndVerifyItsProperties,
    interceptFileUpload,
    waitUntilUploadComplete,
} from './helpers';

describe('Upload Files - Audio', () => {
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

    it('MM-T3825_1 - MP3', () => {
        const properties = {
            filePath: 'mm_file_testing/Audio/MP3.mp3',
            fileName: 'MP3.mp3',
            mimeType: 'audio/mpeg',
            shouldPreview: true,
        };
        testAudioFile(properties);
    });

    it('MM-T3825_2 - M4A', () => {
        const properties = {
            filePath: 'mm_file_testing/Audio/M4A.m4a',
            fileName: 'M4A.m4a',
            shouldPreview: false,
        };
        testAudioFile(properties);
    });

    it('MM-T3825_3 - AAC', () => {
        const properties = {
            filePath: 'mm_file_testing/Audio/AAC.aac',
            fileName: 'AAC.aac',
            mimeType: 'audio/aac',
            shouldPreview: false,
        };
        testAudioFile(properties);
    });

    it('MM-T3825_4 - FLAC', () => {
        const properties = {
            filePath: 'mm_file_testing/Audio/FLAC.flac',
            fileName: 'FLAC.flac',
            shouldPreview: false,
        };
        testAudioFile(properties);
    });

    it('MM-T3825_5 - OGG', () => {
        const properties = {
            filePath: 'mm_file_testing/Audio/OGG.ogg',
            fileName: 'OGG.ogg',
            mimeType: 'audio/ogg',
            shouldPreview: true,
        };
        testAudioFile(properties);
    });

    it('MM-T3825_6 - WAV', () => {
        const properties = {
            filePath: 'mm_file_testing/Audio/WAV.wav',
            fileName: 'WAV.wav',
            mimeType: 'audio/wav',
            shouldPreview: true,
        };
        testAudioFile(properties);
    });

    it('MM-T3825_7 - WMA', () => {
        const properties = {
            filePath: 'mm_file_testing/Audio/WMA.wma',
            fileName: 'WMA.wma',
            shouldPreview: false,
        };
        testAudioFile(properties);
    });
});

function testAudioFile(properties) {
    const {fileName, shouldPreview} = properties;

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

    if (shouldPreview) {
        // * Check if the video element exist
        // Audio is also played by the video element
        cy.get('@filePreviewModal').get('video').should('exist');
    }

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
