// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @files_and_attachments

describe('Image Link Preview', () => {
    let offTopicUrl;

    before(() => {
        // # Enable Link Previews
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLinkPreviews: true,
            },
        });

        // # Create new team and new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            offTopicUrl = out.offTopicUrl;

            // # Enable link previews
            cy.apiSaveLinkPreviewsPreference('true');

            cy.visit(offTopicUrl);
        });
    });

    beforeEach(() => {
        // # Expand image previews
        cy.apiSaveCollapsePreviewsPreference('false');
    });

    it('MM-T331 Image link preview - Collapse and expand', () => {
        const link = 'https://raw.githubusercontent.com/mattermost/mattermost/master/e2e-tests/cypress/tests/fixtures/small-image.png';

        // # Post a link to an externally hosted image
        cy.postMessage(link);

        // # Click to reply to that post, and post that same link again (so you can see it twice in both center and RHS)
        cy.clickPostCommentIcon();

        cy.postMessageReplyInRHS(link);

        cy.getLastPostId().then((postId) => {
            // * Verify it renders correctly both on center and RHS view
            cy.get(`#post_${postId}`).should('be.visible').within(() => {
                cy.findByLabelText('Toggle Embed Visibility').
                    should('be.visible').and('have.attr', 'data-expanded', 'true');
                cy.findByLabelText('file thumbnail').should('be.visible');
            });

            cy.get(`#rhsPost_${postId}`).should('be.visible').within(() => {
                cy.findByLabelText('Toggle Embed Visibility').
                    should('be.visible').and('have.attr', 'data-expanded', 'true');
                cy.findByLabelText('file thumbnail').should('be.visible');
            });

            // # In center, click the collapse arrows to collapse the image preview
            cy.get(`#post_${postId}`).findByLabelText('Toggle Embed Visibility').
                click().
                should('have.attr', 'data-expanded', 'false');

            // * Observe it collapses in both center and RHS view
            cy.get(`#post_${postId}`).findByLabelText('file thumbnail').should('not.exist');

            cy.get(`#rhsPost_${postId}`).findByLabelText('file thumbnail').should('not.exist');

            // # In RHS, click the expand arrows to expand the image preview again
            cy.get(`#rhsPost_${postId}`).findByLabelText('Toggle Embed Visibility').
                click().
                should('have.attr', 'data-expanded', 'true');

            // * Observe it expand in center and RHS
            cy.get(`#post_${postId}`).findByLabelText('file thumbnail').should('be.visible');

            cy.get(`#rhsPost_${postId}`).findByLabelText('file thumbnail').should('be.visible');
        });

        // # In center message box, post slash command /collapse
        cy.postMessage('/collapse ');

        // # Observe all image previews collapse
        cy.findByLabelText('file thumbnail').should('not.exist');

        // # In RHS reply box, post slash command /expand
        cy.postMessageReplyInRHS('/expand ');

        // # All image previews expand back open
        cy.findAllByLabelText('file thumbnail').should('be.visible').and('have.length', 4);
    });

    it('MM-T2389 Inline markdown image links open with preview modal', () => {
        // Go to home channel
        cy.visit(offTopicUrl);

        const markdownImageText = 'exampleImage';
        const markdownImageSrc = 'https://docs.mattermost.com/_images/icon-76x76.png';
        const markdownImageSrcEncoded = encodeURIComponent(markdownImageSrc); // Since the url preview will be encoded string
        const messageWithMarkdownImage = `![${markdownImageText}](${markdownImageSrc}) an image plus some text that has [a link](https://example.com/)`;

        // # Post a message with markdown image and link
        cy.postMessage(messageWithMarkdownImage);

        // # Get the post id of last message with image and link
        cy.getLastPostId().then((postWithMarkdownImage) => {
            // # Scan inside the last post for checking the image
            cy.get(`#${postWithMarkdownImage}_message`).should('exist').and('be.visible').within(() => {
                // * Find the inline image of the markdown text and verify its clickable
                // Image can be found by its alt text is same as the one passed in markdown image title
                cy.findByAltText(markdownImageText).should('exist').and('be.visible').
                    and('have.css', 'cursor', 'pointer').
                    and('have.attr', 'src').should('include', markdownImageSrcEncoded);

                // # Click on the image
                cy.findByAltText(markdownImageText).click();
            });
        });

        const baseUrl = Cypress.config('baseUrl');
        const expectedSrc = `${baseUrl}/api/v4/image?url=${markdownImageSrcEncoded}`;

        // * Verify that the preview modal open up
        cy.uiGetFilePreviewModal().as('filePreviewModal');

        // * Verify we have the image inside the modal
        cy.get('@filePreviewModal').uiGetContentFilePreviewModal().
            find('img').
            should('be.visible').
            and('have.attr', 'alt', 'preview url image').
            and('have.attr', 'src', expectedSrc);

        // # Close the image preview modal
        cy.uiCloseFilePreviewModal();
    });

    it('MM-T1447 Images below a min-width and min-height are posted in a container that is clickable', () => {
        const listOfMinWidthHeightImages = [
            {
                filename: 'image-20x20.jpg',
                originalSize: {width: 20, height: 20},
                thumbnailSize: {width: 20, height: 20},
                containerSize: {height: 46},
            },
            {
                filename: 'image-50x50.jpg',
                originalSize: {width: 50, height: 50},
                thumbnailSize: {width: 50, height: 50},
            },
            {
                filename: 'image-60x60.jpg',
                originalSize: {width: 60, height: 60},
                thumbnailSize: {width: 60, height: 60},
            },
            {
                filename: 'image-400x400.jpg',
                originalSize: {width: 400, height: 400},
                thumbnailSize: {width: 350, height: 350},
            },
            {
                filename: 'image-40x400.jpg',
                originalSize: {width: 40, height: 400},
                thumbnailSize: {width: 35, height: 350},
                containerSize: {width: 46},
            },
            {
                filename: 'image-400x40.jpg',
                originalSize: {width: 400, height: 40},
                thumbnailSize: {width: 400, height: 40},
                containerSize: {height: 46},
            },
            {
                filename: 'image-1000x40.jpg',
                originalSize: {width: 1000, height: 40},
                thumbnailSize: {width: 899, height: 36},
                containerSize: {height: 46},
            },
            {
                filename: 'image-1600x40.jpg',
                originalSize: {width: 1600, height: 40},
                thumbnailSize: {width: 899, height: 23},
                previewSize: {width: 1204, height: 30},
                containerSize: {height: 46},
            },
        ];

        listOfMinWidthHeightImages.forEach(({
            filename,
            originalSize,
            thumbnailSize,
            previewSize,
            containerSize,
        }) => {
            // # Upload Image as attachment and post it
            cy.get('#fileUploadInput').attachFile(filename);
            cy.postMessage(`file uploaded-${filename}`);

            // # If image is below min dimensions then do checks for image container dimensions
            if (containerSize) {
                // * Check if container is rendered for preview of image
                cy.uiGetPostEmbedContainer().
                    find('.small-image__container').
                    should((imageContainer) => {
                        if (containerSize.height) {
                        // * Should match thumbnail's container height
                            expect(imageContainer.height()).to.closeTo(containerSize.height, 1);
                        } else {
                        // * Should match thumbnail's container width
                            expect(imageContainer.width()).to.closeTo(containerSize.width, 1);
                        }
                    });
            }

            // # Get the last uploaded image post
            cy.uiGetPostBody().within(() => {
                // # Find the attached image and verify its dimensions and click on it to open preview modal
                // # Open file preview
                cy.uiGetFileThumbnail(filename).
                    should((imageAttachment) => {
                        // * Check the dimensions of image's dimensions is almost equal to its thumbnail dimensions
                        expect(imageAttachment.height()).to.closeTo(thumbnailSize.height, 1);
                        expect(imageAttachment.width()).to.be.closeTo(thumbnailSize.width, 1);
                    }).
                    click();
            });

            //* Verify image preview modal is opened
            cy.uiGetFilePreviewModal().as('filePreviewModal');

            // * Verify we have the image inside the modal
            cy.get('@filePreviewModal').uiGetContentFilePreviewModal().find('img').should((imagePreview) => {
                // * Verify that preview has correct alt text
                expect(imagePreview.attr('alt')).equals('preview url image');

                // # If image is bigger than viewport, then its preview will be check for dimensions
                if (previewSize) {
                    // * It should match preview dimension for images bigger than viewport
                    expect(imagePreview.height()).to.closeTo(previewSize.height, 1);
                    expect(imagePreview.width()).to.be.closeTo(previewSize.width, 1);
                } else {
                    // * It should match original dimension for images less than viewport size
                    expect(imagePreview.height()).to.closeTo(originalSize.height, 1);
                    expect(imagePreview.width()).to.be.closeTo(originalSize.width, 1);
                }
            });

            // # Close modal
            cy.uiCloseFilePreviewModal();
        });
    });
});
