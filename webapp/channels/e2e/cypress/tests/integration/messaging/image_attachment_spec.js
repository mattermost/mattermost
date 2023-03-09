// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

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
        cy.get('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Image upload');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 24, width: 24},
            container: {height: 45, width: 45},
        });
    });

    it('Image with height smaller than 48px', () => {
        const filename = 'image-small-height.png';

        // # Upload a file on center view
        cy.get('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Image upload');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 24, width: 340},
            container: {height: 45, width: 339},
        });
    });

    it('Image with width smaller than 48px', () => {
        const filename = 'image-small-width.png';

        // # Upload a file on center view
        cy.get('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Image upload');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 350, width: 21},
            container: {height: 348, width: 46},
        });
    });

    it('Image with width and height bigger than 48px', () => {
        const filename = 'MM-logo-horizontal.png';

        // # Upload a file on center view
        cy.get('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Image upload');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 151, width: 955},
        });
    });

    it('opens image preview window when image is clicked', () => {
        const filename = 'MM-logo-horizontal.png';

        // # Upload a file on center view
        cy.get('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Image upload');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 151, width: 955},
            clickPreview: () => cy.uiGetFileThumbnail(filename).click(),
        });

        // * Verify that the preview modal open up
        cy.uiGetFilePreviewModal();

        // # Close the modal
        cy.uiCloseFilePreviewModal();
    });

    it('opens image preview window when small image is clicked', () => {
        const filename = 'small-image.png';

        // # Upload a file on center view
        cy.get('#fileUploadInput').attachFile(filename);

        verifyImageInPostFooter();

        // # Post message
        cy.postMessage('Image upload');

        verifyImageInPostFooter(false);

        // # File thumbnail should have correct dimensions
        verifyFileThumbnail({
            filename,
            actualImage: {height: 24, width: 24},
            container: {height: 45, width: 45},
            clickPreview: () => cy.uiGetFileThumbnail(filename).click(),
        });

        // * Verify that the preview modal open up
        cy.uiGetFilePreviewModal();
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
