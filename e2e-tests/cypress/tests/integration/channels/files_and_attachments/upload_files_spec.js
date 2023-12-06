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
    downloadAttachmentAndVerifyItsProperties,
    interceptFileUpload,
    waitUntilUploadComplete,
} from './helpers';

describe('Upload Files', () => {
    let channelUrl;
    let channelId;
    let testUser;

    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        // # Init setup
        cy.apiInitSetup().then((out) => {
            channelUrl = out.channelUrl;
            channelId = out.channel.id;
            testUser = out.user;

            cy.visit(channelUrl);
            interceptFileUpload();
        });
    });

    it('MM-T336 Image thumbnail - expanded RHS', () => {
        const filename = 'huge-image.jpg';
        const originalWidth = 1920;
        const originalHeight = 1280;
        const aspectRatio = originalWidth / originalHeight;

        // # Post an image in center channel
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
        waitUntilUploadComplete();
        cy.uiGetPostTextBox().clear().type('{enter}');

        // # Click reply arrow to open the reply thread in RHS
        cy.clickPostCommentIcon();

        cy.uiGetRHS().within(() => {
            // # Observe image thumbnail displays the same
            cy.uiGetFileThumbnail(filename).should((img) => {
                expect(img.width() / img.height()).to.be.closeTo(aspectRatio, 1);
            });

            // # In the RHS, click the expand arrows to expand the RHS
            cy.uiExpandRHS();
        });

        cy.uiGetRHS().isExpanded().within(() => {
            // * Observe image thumbnail displays the same
            cy.uiGetFileThumbnail(filename).should((img) => {
                expect(img.width() / img.height()).to.be.closeTo(aspectRatio, 1);
            });
        });

        // # Close the RHS panel
        cy.uiCloseRHS();
    });

    it('MM-T340 Download - File name link on thumbnail', () => {
        const attachmentFilesList = [
            {
                filename: 'word-file.doc',
                extensions: 'DOC',
                type: 'document',
            },
            {
                filename: 'wordx-file.docx',
                extensions: 'DOCX',
                type: 'document',
            },
            {
                filename: 'powerpoint-file.ppt',
                extensions: 'PPT',
                type: 'document',
            },
            {
                filename: 'powerpointx-file.pptx',
                extensions: 'PPTX',
                type: 'document',
            },
            {
                filename: 'jpg-image-file.jpg',
                extensions: 'JPG',
                type: 'image',
            },
        ];

        attachmentFilesList.forEach((file) => {
            // # Attach the file as attachment and post a message
            cy.get('#fileUploadInput').attachFile(file.filename);
            waitUntilUploadComplete();
            cy.postMessage('hello');
            cy.uiWaitUntilMessagePostedIncludes('hello');

            // # Get the body of the last post
            cy.uiGetPostBody().within(() => {
                // # If file type is document then file container will be rendered
                if (file.type === 'document') {
                    // * Check if the download icon exists
                    cy.findByLabelText('download').then((fileAttachment) => {
                        // * Verify if download attribute exists which allows to download instead of navigation
                        expect(fileAttachment.attr('download')).to.equal(file.filename);

                        const fileAttachmentURL = fileAttachment.attr('href');

                        // * Verify that download link has correct name
                        downloadAttachmentAndVerifyItsProperties(fileAttachmentURL, file.filename, 'attachment');
                    });

                    // * Check if the file name is shown in the attachment
                    cy.findByText(file.filename);

                    // * Check if correct extension is shown in the attachment and click to open preview
                    cy.findByText(file.extensions).click();
                } else if (file.type === 'image') {
                    // # Check that image is shown and then click to open the preview
                    cy.uiGetFileThumbnail(file.filename).click();
                }
            });

            // * Verify image preview modal is opened
            cy.uiGetFilePreviewModal().as('filePreviewModal');

            // * Download button should exist
            cy.get('@filePreviewModal').uiGetDownloadFilePreviewModal().then((downloadLink) => {
                expect(downloadLink.attr('download')).to.equal(file.filename);

                const fileAttachmentURL = downloadLink.attr('href');

                // * Verify that download link has correct name
                downloadAttachmentAndVerifyItsProperties(fileAttachmentURL, file.filename, 'attachment');
            });

            // # Close the modal
            cy.uiCloseFilePreviewModal();
        });
    });

    it('MM-T341 Download link on preview - Image file (non SVG)', () => {
        const imageFilenames = [
            'bmp-image-file.bmp',
            'png-image-file.png',
            'jpg-image-file.jpg',
            'gif-image-file.gif',
            'tiff-image-file.tif',
        ];

        imageFilenames.forEach((filename) => {
            cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
            waitUntilUploadComplete();
            cy.postMessage('hello');
            cy.uiWaitUntilMessagePostedIncludes('hello');
            cy.uiGetFileThumbnail(filename).click();

            // * Verify image preview modal is opened
            cy.uiGetFilePreviewModal().as('filePreviewModal');

            // * Download button should exist
            cy.get('@filePreviewModal').uiGetDownloadFilePreviewModal().then((downloadLink) => {
                expect(downloadLink.attr('download')).to.equal(filename);

                const fileAttachmentURL = downloadLink.attr('href');

                // * Verify that download link has correct name
                downloadAttachmentAndVerifyItsProperties(fileAttachmentURL, filename, 'attachment');
            });

            // # Close the modal
            cy.uiCloseFilePreviewModal();
        });
    });

    it('MM-T12 Loading indicator when posting images', () => {
        const filename = 'huge-image.jpg';

        // # Post an image in center channel
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
        waitUntilUploadComplete();
        cy.uiGetPostTextBox().clear().type('{enter}');

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Reload the page
        cy.reload();

        // * Verify the image container is visible
        cy.get('.image-container').should('be.visible');

        Cypress._.times(5, () => {
            // # OtherUser creates posts in the channel
            cy.postMessageAs({
                sender: testUser,
                message: 'message',
                channelId,
            });

            // * Verify image is not loading for each posts
            cy.get('.image-container').should('be.visible').find('.image-loading__container').should('not.exist');

            cy.wait(TIMEOUTS.HALF_SEC);
        });
    });

    it('MM-T337 CTRL/CMD+U - Five files on one message, thumbnails while uploading', () => {
        cy.visit(channelUrl);
        const filename = 'huge-image.jpg';
        Cypress._.times(5, () => {
            cy.get('#fileUploadInput').attachFile(filename);
            waitUntilUploadComplete();
        });
        for (let i = 1; i < 4; i++) {
            cy.get(`:nth-child(${i}) > .post-image__thumbnail > .post-image`).should('be.visible');
        }
        cy.get(':nth-child(5) > .post-image__thumbnail > .post-image').should('not.be.visible');
        cy.get('.file-preview__container').scrollTo('right');
        for (let i = 1; i < 3; i++) {
            cy.get(`:nth-child(${i}) > .post-image__thumbnail > .post-image`).should('not.be.visible');
        }
        cy.get(':nth-child(5) > .post-image__thumbnail > .post-image').should('be.visible');
        cy.postMessage('test');
        cy.findByTestId('fileAttachmentList').find('.post-image').should('have.length', 5);
    });

    it('MM-T338 Image Attachment Upload in Mobile View', () => {
        // # Set the viewport to mobile
        cy.viewport('iphone-6');

        // # Scan inside of the message input region
        cy.findByLabelText('Login Successful message input complimentary region').should('be.visible').within(() => {
            // * Check if the attachment button is present
            cy.findByLabelText('Attachment Icon').should('be.visible').and('have.css', 'cursor', 'pointer');
        });

        const imageFilename = 'jpg-image-file.jpg';
        const imageType = 'JPG';

        // # Attach an image but don't post it yet
        cy.get('#fileUploadInput').attachFile(imageFilename);
        waitUntilUploadComplete();

        // # Scan inside of the message footer region
        cy.get('#advancedTextEditorCell').should('be.visible').within(() => {
            // * Verify that image name is present
            cy.findByText(imageFilename).should('be.visible');

            // * Verify that image type is present
            cy.findByText(imageType).should('be.visible');

            // # Get the image preview div
            cy.get('.post-image.normal').then((imageDiv) => {
                // # Filter out the url from the css background property
                // url("https://imageurl") => https://imageurl
                const imageURL = imageDiv.css('background-image').split('"')[1];

                downloadAttachmentAndVerifyItsProperties(imageURL, imageFilename, 'inline');
            });
        });

        // # Now post with the message attachment
        cy.uiGetPostTextBox().clear().type('{enter}');

        // * Check that the image in the post is with valid source link
        cy.uiGetFileThumbnail(imageFilename).should('have.attr', 'src').then((src) => {
            downloadAttachmentAndVerifyItsProperties(src, imageFilename, 'inline');
        });
    });

    it('MM-T2265 Multiple File Upload - 5 is successful (image, video, code, pdf, audio, other)', () => {
        const attachmentFilesList = [
            {
                filename: 'word-file.doc',
                extensions: 'DOC',
                type: 'document',
            },
            {
                filename: 'wordx-file.docx',
                extensions: 'DOCX',
                type: 'document',
            },
            {
                filename: 'powerpoint-file.ppt',
                extensions: 'PPT',
                type: 'document',
            },
            {
                filename: 'powerpointx-file.pptx',
                extensions: 'PPTX',
                type: 'document',
            },
            {
                filename: 'jpg-image-file.jpg',
                extensions: 'JPG',
                type: 'image',
            },
        ];
        const minimumSeparation = 5;

        cy.visit(channelUrl);
        cy.uiGetPostTextBox();

        // # Upload files
        Cypress._.forEach(attachmentFilesList, ({filename}) => {
            cy.get('#fileUploadInput').attachFile(filename);
            waitUntilUploadComplete();
        });

        // # Wait for files to finish uploading
        cy.wait(TIMEOUTS.THREE_SEC);

        // # Post message
        cy.postMessage('test');
        cy.findByTestId('fileAttachmentList').within(() => {
            for (let i = 1; i < 5; i++) {
                // * Elements should have space between them
                cy.get(`:nth-child(${i}) > .post-image__details`).then((firstAttachment) => {
                    cy.get(`:nth-child(${i + 1}) > .post-image__thumbnail`).then((secondAttachment) => {
                        expect(firstAttachment[0].getBoundingClientRect().right + minimumSeparation < secondAttachment[0].getBoundingClientRect().left ||
                        firstAttachment[0].getBoundingClientRect().bottom + minimumSeparation < secondAttachment[0].getBoundingClientRect().top).to.be.true;
                    });
                });
            }
        });

        cy.uiOpenFilePreviewModal();

        // * Verify image preview modal is opened
        cy.uiGetFilePreviewModal().as('filePreviewModal');

        // * Should show first file
        cy.get('@filePreviewModal').uiGetHeaderFilePreviewModal().within(() => {
            cy.findByText(attachmentFilesList[0].filename);
        });

        // # Move to the next element using right arrow
        cy.get('@filePreviewModal').uiGetArrowRightFilePreviewModal().click();

        // * Should show second file
        cy.get('@filePreviewModal').uiGetHeaderFilePreviewModal().within(() => {
            cy.findByText(attachmentFilesList[1].filename);
        });

        // # Move back to the previous element using left arrow
        cy.get('@filePreviewModal').uiGetArrowLeftFilePreviewModal().click();

        // * Should show first file again
        cy.get('@filePreviewModal').uiGetHeaderFilePreviewModal().within(() => {
            cy.findByText(attachmentFilesList[0].filename);
        });
    });

    it('MM-T2261 Upload SVG and post', () => {
        const filename = 'svg.svg';
        const aspectRatio = 1;

        cy.visit(channelUrl);
        cy.uiGetPostTextBox();

        // # Attach file
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
        waitUntilUploadComplete();

        cy.get('#create_post').find('.file-preview').within(() => {
            // * Filename is correct
            cy.get('.post-image__name').should('contain.text', filename);

            // * Type is correct
            cy.get('.post-image__type').should('contain.text', 'SVG');

            // * Size is correct
            cy.get('.post-image__size').should('contain.text', '6KB');

            // * Img thumbnail exist
            cy.get('.post-image__thumbnail > img').should('exist');
        });

        // # Post message
        cy.postMessage('hello');
        cy.uiWaitUntilMessagePostedIncludes('hello');

        // # Open file preview
        cy.uiGetFileThumbnail(filename).click();

        // * Verify image preview modal is opened
        cy.uiGetFilePreviewModal().as('filePreviewModal');

        cy.get('@filePreviewModal').uiGetContentFilePreviewModal().find('img').should((img) => {
            // * Image aspect ratio is maintained
            expect(img.width() / img.height()).to.be.closeTo(aspectRatio, 1);
        });

        // * Download button should exist
        cy.get('@filePreviewModal').uiGetDownloadFilePreviewModal().then((downloadLink) => {
            expect(downloadLink.attr('download')).to.equal(filename);

            const fileAttachmentURL = downloadLink.attr('href');

            // * Verify that download link has correct name
            downloadAttachmentAndVerifyItsProperties(fileAttachmentURL, filename, 'attachment');
        });

        // # Close modal
        cy.uiCloseFilePreviewModal();
    });
});
