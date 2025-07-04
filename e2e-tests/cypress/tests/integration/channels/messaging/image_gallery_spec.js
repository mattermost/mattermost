// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging @smoke

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

    it('should display gallery grid when post has 2+ images', () => {
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
            cy.get('.post-image__thumbnail').should('be.visible');
        });

        // # Post the images
        const uniqueMessage = `Gallery test ${Date.now()}`;
        cy.postMessage(uniqueMessage);

        // * Verify gallery layout is displayed
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(() => {
                cy.findByTestId('fileAttachmentList').within(() => {
                    cy.findByTestId('image-gallery__toggle').should('contain.text', '4 images');
                    cy.findByTestId('image-gallery__body').should('not.have.class', 'collapsed').within(() => {
                        cy.findByTestId('image-gallery__item').should('have.length', 4);
                        cy.get('.image-gallery__item--small').should('have.length', 3);
                        
                        // * Verify images display with reasonable aspect ratios
                        cy.findByTestId('image-gallery__item').each(($item) => {
                            cy.wrap($item).find('img').should('be.visible').and(($img) => {
                                const renderedRatio = $img.width() / $img.height();
                                expect(renderedRatio).to.be.greaterThan(0.01);
                                expect(renderedRatio).to.be.lessThan(100);
                            });
                        });
                    });
                    
                    // * Test collapse/expand functionality
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
            
            // * Test image preview modal opens when clicking gallery items
            cy.findByTestId('fileAttachmentList').within(() => {
                cy.findByTestId('image-gallery__item').first().click();
            });
            
            cy.get('.FilePreviewModal').should('be.visible');
            cy.get('.FilePreviewModal__close').click();
            cy.get('.FilePreviewModal').should('not.exist');
        });
    });

    it('should use traditional layout when post has mixed content types', () => {
        cy.get('#channelHeaderTitle', {timeout: 30000}).should('be.visible');
        cy.get('#post_textbox', {timeout: 30000}).should('be.visible');

        const files = [
            {filename: 'image-small-height.png', type: 'image'},
            {filePath: 'mm_file_testing/Documents/PDF.pdf', fileName: 'PDF.pdf', type: 'document'},
            {filename: 'huge-image.jpg', type: 'image'},
        ];

        // # Upload mixed content files
        files.forEach((file) => {
            cy.get('#post_textbox').should('be.visible').click();
            cy.get('#advancedTextEditorCell', {timeout: 10000}).should('be.visible').within(() => {
                if (file.filePath) {
                    // Handle PDF upload with binary content
                    cy.fixture(file.filePath, 'binary').
                        then(Cypress.Blob.binaryStringToBlob).
                        then((fileContent) => {
                            cy.get('#fileUploadInput').attachFile({
                                fileContent,
                                fileName: file.fileName,
                                mimeType: file.mimeType,
                                encoding: 'utf8',
                            });
                        });
                } else {
                    cy.get('#fileUploadInput').should('exist').attachFile(file.filename);
                }
            });
            cy.findByTestId('post-image__thumbnail').should('be.visible');
        });

        const uniqueMessage = `Traditional layout test ${Date.now()}`;
        cy.postMessage(uniqueMessage);

        // * Verify traditional file attachment layout (no gallery)
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(() => {
                cy.findByTestId('fileAttachmentList').should('exist').and('be.visible').within(() => {
                    cy.findByTestId('image-gallery__toggle').should('not.exist');
                    cy.findByTestId('image-gallery__body').should('not.exist');
                    cy.findByTestId('post-image__column').should('have.length', 3);
                    cy.findByTestId('post-image__column').each(($column) => {
                        cy.wrap($column).should('be.visible');
                        cy.wrap($column).find('.post-image__thumbnail').should('be.visible');
                    });
                    cy.findByTestId('post-image__column').contains('PDF.pdf').should('exist');
                });
            });
        });
    });
});

function verifyFileThumbnail({filename, actualImage = {}, container = {}, clickPreview}) {
    // # File thumbnail should have correct dimensions
    cy.getLastPostId().then((postId) => {
        // * Verify that the image is inside a container div
        cy.get(`#${postId}_message`).within(() => {
            cy.uiGetFileThumbnail(filename).
                should((img) => {
                    expect(img.height()).to.be.closeTo(actualImage.height, 2.0);
                    expect(img.width()).to.be.closeTo(actualImage.width, 2.0);
                }).
                parent().
                should((img) => {
                    if (container.width || container.height) {
                        expect(img.height()).to.be.closeTo(container.height, 2.0);
                        expect(img.width()).to.be.closeTo(container.width, 2.0);
                    }
                });

            if (clickPreview) {
                // # Open file preview
                clickPreview();
            }
        });
    });
}

function verifyImageInPostFooter(verifyExistence = true) {
    // * Verify that the image exists or not
    cy.get('#advancedTextEditorCell').find('.file-preview').should(verifyExistence ? 'be.visible' : 'not.exist');
}
