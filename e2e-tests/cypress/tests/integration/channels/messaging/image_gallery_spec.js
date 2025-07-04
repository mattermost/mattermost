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
    let team;
    let channel;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then((initData) => {
            team = initData.team;
            Cypress.env('team', team);
        });
    });

    beforeEach(() => {
        // Create a unique channel for each test
        cy.apiCreateChannel(Cypress.env('team').id, `test-channel-${Date.now()}`, 'Test Channel').then(({channel: newChannel}) => {
            channel = newChannel;
            cy.visit(`/${Cypress.env('team').name}/channels/${channel.name}`);
            cy.get('#channelHeaderTitle', {timeout: 30000}).should('be.visible');
            cy.get('#post_textbox', {timeout: 30000}).should('be.visible');
        });
    });

    it('Gallery grid layout with multiple images', () => {
        // Ensure we're in a clean state before starting the test
        cy.get('#channelHeaderTitle', {timeout: 30000}).should('be.visible');
        cy.get('#post_textbox', {timeout: 30000}).should('be.visible');

        const images = [
            {filename: 'image-small-height.png', width: 340, height: 24},
            {filename: 'image-small-width.png', width: 21, height: 350},
            {filename: 'MM-logo-horizontal.png', width: 906, height: 144},
            {filename: 'huge-image.jpg', width: 1920, height: 1280},
        ];

        // # Upload multiple images
        images.forEach((image) => {
            cy.get('#post_textbox').should('be.visible').click();
            cy.get('#advancedTextEditorCell', {timeout: 10000}).should('be.visible').within(() => {
                cy.get('#fileUploadInput').should('exist').attachFile(image.filename);
            });
            // Image thumbnails should be visible
            cy.get('.post-image__thumbnail').should('be.visible');
        });

        // # Post the images with a unique message
        const uniqueMessage = `Multiple images test ${Date.now()}`;
        cy.postMessage(uniqueMessage);

        // * Get the post ID of the message just posted
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(() => {
                cy.findByTestId('fileAttachmentList').within(() => {
                    // Verify gallery is expanded by default
                    cy.findByTestId('image-gallery__toggle').should('contain.text', '4 images');
                    // Gallery should be expanded by default
                    cy.findByTestId('image-gallery__body').should('not.have.class', 'collapsed').within(() => {
                        cy.findByTestId('image-gallery__item').should('have.length', 4);
                        cy.get('.image-gallery__item--small').should('have.length', 3);
                        images.forEach((image, index) => {
                            cy.get(`.image-gallery__item:nth-child(${index + 1})`).within(() => {
                                cy.get('img').and(($img) => {
                                    const renderedRatio = $img.width() / $img.height();
                                    const originalRatio = image.width / image.height;

                                    // With objectFit: cover, images are cropped to fit containers
                                    // so we test for reasonable display rather than exact ratios
                                    if (originalRatio > 5) {
                                        // Very wide images should be constrained but still reasonably wide
                                        expect(renderedRatio).to.be.greaterThan(1.0);
                                        expect(renderedRatio).to.be.lessThan(15);
                                    } else if (originalRatio < 0.2) {
                                        // Very tall images should be constrained but still reasonably tall
                                        expect(renderedRatio).to.be.greaterThan(0.05);
                                        expect(renderedRatio).to.be.lessThan(1.0);
                                    } else {
                                        // Normal images should maintain reasonable proportions
                                        expect(renderedRatio).to.be.greaterThan(0.5);
                                        expect(renderedRatio).to.be.lessThan(10);
                                    }
                                });
                            });
                        });
                    });
                    cy.findByTestId('image-gallery__toggle').click();
                    cy.findByTestId('image-gallery__body').should('have.class', 'collapsed');
                    cy.findByTestId('image-gallery__toggle').should('contain.text', 'Show 4 images');
                    cy.findByTestId('image-gallery__item').should('not.be.visible');
                    cy.findByTestId('image-gallery__toggle').click();
                    cy.findByTestId('image-gallery__body').should('not.have.class', 'collapsed');
                    cy.findByTestId('image-gallery__toggle').should('contain.text', '4 images');
                    cy.findByTestId('image-gallery__item').should('exist').and('be.visible');
                });
            });
            // Click on first image to open viewer
            cy.findByTestId('fileAttachmentList').within(() => {
                cy.findByTestId('image-gallery__item').first().click();
            });
            
            // Verify that viewer opens with first image
            cy.get('.FilePreviewModal').should('be.visible');
            cy.get('.FilePreviewModal__close').should('be.visible');
            cy.get('.FilePreviewModal__close').click();
            
            // Verify that viewer closes
            cy.get('.FilePreviewModal').should('not.exist');
        });
    });

    it('Gallery with mixed content types', () => {
        // Ensure we're in a clean state before starting the test
        cy.get('#channelHeaderTitle', {timeout: 30000}).should('be.visible');
        cy.get('#post_textbox', {timeout: 30000}).should('be.visible');

        const files = [
            {filename: 'image-small-height.png', type: 'image'},
            {filePath: 'mm_file_testing/Documents/PDF.pdf', fileName: 'PDF.pdf', type: 'document'},
            {filename: 'huge-image.jpg', type: 'image'},
        ];

        files.forEach((file) => {
            cy.get('#post_textbox').should('be.visible').click();
            cy.get('#advancedTextEditorCell', {timeout: 10000}).should('be.visible').within(() => {
                if (file.filePath) {
                    attachFile({
                        filePath: file.filePath,
                        fileName: file.fileName,
                        mimeType: 'application/pdf',
                    });
                } else {
                    cy.get('#fileUploadInput').should('exist').attachFile(file.filename);
                }
            });
            // Image thumbnails should be visible
            cy.findByTestId('post-image__thumbnail').should('be.visible');
        });

        const uniqueMessage = `Mixed content test ${Date.now()}`;
        cy.postMessage(uniqueMessage);

        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(() => {
                cy.findByTestId('fileAttachmentList').should('exist').and('be.visible').within(() => {
                    // Verify no gallery toggle when < 4 images
                    cy.findByTestId('image-gallery__toggle').should('not.exist');
                    cy.findByTestId('image-gallery__body').should('not.exist');
                    cy.findByTestId('post-image__column').should('have.length', 3);
                    cy.findByTestId('post-image__column').each(($column) => {
                        cy.wrap($column).should('be.visible');
                        cy.wrap($column).find('.post-image__thumbnail').should('be.visible');
                    });
                });
                
                // Verify non-images are handled properly
                cy.findByTestId('fileAttachmentList').within(() => {
                    cy.findByTestId('post-image__column').contains('PDF.pdf').should('exist');
                });
            });
        });
    });
});
