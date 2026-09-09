// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod

describe('Scroll', () => {
    let testTeam;

    beforeEach(() => {
        // # Create new team and new user and visit Town Square channel
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;

            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
        });
    });

    it('MM-T2369 Aspect Ratio is preserved in RHS', () => {
        const uploadedImages = [
            {
                file: 'image-small-height.png',
                width: 340,
                height: 25,
            },
            {
                file: 'image-small-width.png',
                width: 22,
                height: 352,
            },
        ];

        uploadedImages.forEach((uploadedImage) => {
            // # Upload the image
            cy.intercept('POST', '**/api/v4/files').as('uploadFile');
            cy.get('#fileUploadInput').should('exist').attachFile(uploadedImage.file);
            cy.wait('@uploadFile').its('response.statusCode').should('be.oneOf', [200, 201]);

            // * Verify the file preview is shown
            cy.get('[data-testid="file-preview-item"]').should('be.visible');

            // # Post the image
            cy.postMessage(uploadedImage.file);

            // * Verify the last post includes the uploaded file
            cy.findAllByTestId('postView').last().should(($post) => {
                expect($post.find('.file-view--single').length, 'file attach').to.be.greaterThan(0);
            });

            cy.getLastPostId().then((postId) => {
                // # Get uploaded image in the center
                cy.get(`#post_${postId}`).within(() => {
                    cy.contains(uploadedImage.file).should('be.visible');

                    // * Verify image was uploaded and its aspect ratio is unchanged
                    verifyImageAspectRatioCorrectness(uploadedImage);
                });

                // # Open the message with image in RHS
                cy.clickPostCommentIcon(postId);

                // # Go to RHS where image is now opened
                cy.get('#rhsContainer').within(() => {
                    // * Verify image in the RHS has correct aspect ratio
                    verifyImageAspectRatioCorrectness(uploadedImage);
                });

                cy.uiCloseRHS();
            });
        });
    });
});

function verifyImageAspectRatioCorrectness(originalImage) {
    const expected = originalImage.width / originalImage.height;
    cy.get('.file-view--single').then(($view) => {
        const $toggle = $view.find('.single-image-view__toggle');
        if ($toggle.length && $toggle.attr('data-expanded') === 'false') {
            cy.wrap($toggle).click({force: true});
        }
    });
    cy.get('.file-view--single .image-loaded img').
        should('be.visible').
        and(($img) => {
            const img = $img[0];
            expect(img.complete, 'decoded').to.equal(true);
            expect(img.naturalWidth, 'loaded').to.be.greaterThan(0);
            expect(img.naturalWidth / img.naturalHeight).to.be.closeTo(expected, 0.02);
        });
}
