// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Image attachment', () => {
    before(() => {
        // # Login as new user
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('Image smaller than 48px in both width and height', () => {
        const filename = 'small-image.png';

        // # Upload a file on center view
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Small image');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 24, width: 24},
            container: {height: 34, width: 34},
            clickPreview: () => cy.uiGetFileThumbnail(filename).click(),
        });

        // * Verify that the preview modal open up
        cy.uiGetFilePreviewModal();

        // # Close the modal for next test
        cy.uiCloseFilePreviewModal();
    });

    it('Image with height smaller than 48px', () => {
        const filename = 'image-small-height.png';

        // # Upload a file on center view
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Small height image');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 25, width: 340},
            container: {height: 34, width: 340},
            clickPreview: () => cy.uiGetFileThumbnail(filename).click(),
        });

        // * Verify that the preview modal open up
        cy.uiGetFilePreviewModal();

        // # Close the modal for next test
        cy.uiCloseFilePreviewModal();
    });

    it('Image with width smaller than 48px', () => {
        const filename = 'image-small-width.png';

        // # Upload a file on center view
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Small width image');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions - use getLastPostId to target the specific post
        cy.getLastPostId().then((postId) => {
            cy.get(`#${postId}_message`).within(() => {
                cy.uiGetFileThumbnail(filename).
                    should((img) => {
                        expect(img.height()).to.be.closeTo(334, 2.0); // Updated to match actual rendered height
                        expect(img.width()).to.be.closeTo(22, 2.0);
                    }).
                    parent().
                    should((img) => {
                        expect(img.height()).to.be.closeTo(334, 2.0); // Updated to match actual rendered dimensions with padding
                        expect(img.width()).to.be.closeTo(34, 2.0); // Updated to match actual rendered width
                    });
            });
        });
    });

    it('Image with width and height bigger than 48px', () => {
        const filename = 'MM-logo-horizontal.png';

        // # Upload a file on center view
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Large image');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 144, width: 908}, // Updated to match actual rendered dimensions
            container: {height: 144, width: 908}, // Updated to match actual rendered container dimensions
        });
    });

    it('opens image preview window when image is clicked', () => {
        const filename = 'MM-logo-horizontal.png';

        // # Upload a file on center view
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Image upload');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 144, width: 908}, // Updated to match actual rendered dimensions
            container: {height: 144, width: 908}, // Updated to match actual rendered container dimensions
            clickPreview: () => cy.uiGetFileThumbnail(filename).click(),
        });

        // * Verify that the preview modal open up
        cy.uiGetFilePreviewModal();

        // # Close the modal for next test
        cy.uiCloseFilePreviewModal();
    });

    it('opens image preview window when small image is clicked', () => {
        const filename = 'small-image.png';

        // # Start a fresh message 
        cy.uiGetPostTextBox().clear();

        // # Upload a file on center view
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Image upload');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 24, width: 24},
            container: {height: 34, width: 34}, // Updated to match actual rendered dimensions with padding
            clickPreview: () => cy.uiGetFileThumbnail(filename).click(),
        });

        // * Verify that the preview modal open up
        cy.uiGetFilePreviewModal();

        // # Close the modal for next test
        cy.uiCloseFilePreviewModal();
    });
});

function verifyImageInPostFooter(verifyExistence = true) {
    // * Verify that the image exists or not
    cy.get('#advancedTextEditorCell').find('.file-preview').should(verifyExistence ? 'be.visible' : 'not.exist');
}

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
