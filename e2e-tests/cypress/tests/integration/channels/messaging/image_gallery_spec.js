// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging @smoke

import {attachFile} from '../files_and_attachments/helpers';

describe('Image Gallery', () => {
    before(() => {
        // # Create new team and new user and visit Town Square channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.apiGetChannelByName(team.name, 'town-square').then(({channel}) => {
                // Use cy.request to fetch posts
                cy.request(`/api/v4/channels/${channel.id}/posts?per_page=100`).then((response) => {
                    const posts = response.body.posts;
                    const postIds = Object.keys(posts);
                    postIds.forEach((postId) => {
                        cy.apiDeletePost(postId);
                    });
                });
            });
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T1798 Gallery grid layout with multiple images', () => {
        // Wait for channel to be fully loaded
        cy.get('#channelHeaderTitle').should('be.visible');
        cy.get('#post_textbox').should('be.visible');

        const images = [
            {filename: 'image-small-height.png', width: 340, height: 24},
            {filename: 'image-small-width.png', width: 21, height: 350},
            {filename: 'MM-logo-horizontal.png', width: 906, height: 144},
            {filename: 'huge-image.jpg', width: 1920, height: 1280},
        ];

        // # Upload multiple images
        images.forEach((image) => {
            // Wait for the text editor to be ready
            cy.get('#post_textbox').should('be.visible').click();
            cy.get('#advancedTextEditorCell', {timeout: 10000}).should('be.visible').within(() => {
                cy.get('#fileUploadInput').should('exist').attachFile(image.filename);
            });
            cy.get('.post-image__thumbnail').should('be.visible');
        });

        // # Post the images
        cy.postMessage('Multiple images test');

        // * Get the last post and verify gallery only shows images
        cy.getLastPost().within(() => {
            cy.findByTestId('fileAttachmentList').within(() => {
                // * Verify gallery header shows correct count
                cy.get('.image-gallery__toggle').should('contain.text', '4 images');

                // * Verify download all button exists
                cy.findByText('Download all');

                // * Verify gallery body and images
                cy.get('.image-gallery__body').should('not.have.class', 'collapsed').within(() => {
                    // * Verify all images are rendered
                    cy.get('.image-gallery__item').should('have.length', 4);
                    cy.get('.image-gallery__item--small').should('have.length', 3);

                    // * Verify images maintain aspect ratio
                    images.forEach((image, index) => {
                        cy.get(`.image-gallery__item:nth-child(${index + 1})`).within(() => {
                            cy.get('img').and(($img) => {
                                const renderedRatio = $img.width() / $img.height();
                                const originalRatio = image.width / image.height;

                                if (originalRatio > 5) {
                                    expect(renderedRatio).to.be.lessThan(originalRatio);
                                    expect(renderedRatio).to.be.greaterThan(0.5);
                                } else if (originalRatio < 0.2) {
                                    expect(renderedRatio).to.be.greaterThan(0.05);
                                } else {
                                    expect(renderedRatio).to.be.closeTo(originalRatio, 0.1);
                                }
                            });
                        });
                    });
                });

                // * Verify gallery collapse/expand functionality
                // First collapse the gallery
                cy.get('.image-gallery__toggle').click();
                cy.get('.image-gallery__body').should('have.class', 'collapsed');
                cy.get('.image-gallery__toggle').should('contain.text', 'Show 4 images');

                // Verify gallery items don't exist when collapsed
                cy.get('.image-gallery__item').should('not.exist');

                // Then expand the gallery
                cy.get('.image-gallery__toggle').click();
                cy.get('.image-gallery__body').should('not.have.class', 'collapsed');
                cy.get('.image-gallery__toggle').should('contain.text', '4 images');

                // Verify gallery items exist and are visible when expanded
                cy.get('.image-gallery__item').should('exist').and('be.visible');
            });
        });

        // * Verify clicking an image opens preview modal
        cy.get('.image-gallery__item').first().click();
        cy.uiGetFilePreviewModal().should('exist');
        cy.uiCloseFilePreviewModal();

        // * Verify download all functionality
        cy.findByText('Download all').click();

        // Note: We can't verify actual downloads in Cypress, but we can verify the button state
        cy.findByText('Download all').should('have.attr', 'disabled');
    });

    it('MM-T1799 Gallery with mixed content types', () => {
        // Wait for channel to be fully loaded
        cy.get('#channelHeaderTitle').should('be.visible');
        cy.get('#post_textbox').should('be.visible');

        const files = [
            {filename: 'image-small-height.png', type: 'image'},
            {filePath: 'mm_file_testing/Documents/PDF.pdf', fileName: 'PDF.pdf', type: 'document'},
            {filename: 'huge-image.jpg', type: 'image'},
        ];

        // # Upload mixed content
        files.forEach((file) => {
            // Wait for the text editor to be ready
            cy.get('#post_textbox').should('be.visible').click();
            cy.get('#advancedTextEditorCell', {timeout: 10000}).should('be.visible').within(() => {
                if (file.filePath) {
                    // Use attachFile helper for PDF
                    attachFile({
                        filePath: file.filePath,
                        fileName: file.fileName,
                        mimeType: 'application/pdf',
                    });
                } else {
                    // Use direct attach for images
                    cy.get('#fileUploadInput').should('exist').attachFile(file.filename);
                }
            });
            cy.get('.post-image__thumbnail').should('be.visible');
        });

        // # Post the files
        cy.postMessage('Mixed content test');

        // * Get the last post and verify files are shown in attachment list
        cy.getLastPost().within(() => {
            // * Verify file attachment list exists with all files
            cy.findByTestId('fileAttachmentList').should('exist').and('be.visible').within(() => {
                // * Verify no gallery elements exist
                cy.get('.image-gallery__toggle').should('not.exist');
                cy.get('.image-gallery__body').should('not.exist');

                // * Verify all files are shown in the attachment list
                cy.get('.post-image__column').should('have.length', 3);

                // * Verify that only image columns have image thumbnails
                cy.get('.post-image__column').each(($column) => {
                    cy.wrap($column).then(($el) => {
                        const hasPdf = $el.text().includes('PDF.pdf');
                        if (hasPdf) {
                            // PDF should have a file icon
                            cy.wrap($el).find('.file-icon').should('exist');
                            cy.wrap($el).find('.post-image').should('not.exist');
                        } else {
                            // Images should have a post-image div with background-image
                            cy.wrap($el).find('.post-image').should('exist');
                            cy.wrap($el).find('.file-icon').should('not.exist');
                        }
                    });
                });

                // * Verify PDF is shown as a document in the attachment list
                cy.get('.post-image__column').contains('PDF.pdf').should('exist');
            });
        });
    });
});
