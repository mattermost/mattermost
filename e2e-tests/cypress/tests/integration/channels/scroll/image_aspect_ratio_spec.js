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
                file: 'wide-image.png',
                width: 96,
                height: 24,
            },
            {
                file: 'tall-image.png',
                width: 24,
                height: 96,
            },
        ];

        uploadedImages.forEach((uploadedImage) => {
            // # Attach a local image so the preview is served by this server
            cy.get('#fileUploadInput').attachFile(uploadedImage.file);
            cy.get('.post-image__thumbnail').should('be.visible');
            cy.uiGetPostTextBox().clear().type('{enter}');

            // # Get uploaded image in the center
            cy.getLastPost().within(() => {
                // * Verify image was uploaded and its aspect ratio is unchanged
                verifyImageAspectRatioCorrectness(uploadedImage);
            });

            // # Open the message with image in RHS
            cy.clickPostCommentIcon();

            // # Go to RHS where image is now opened
            cy.get('#rhsContainer').within(() => {
                // * Verify image in the RHS has correct aspect ratio
                verifyImageAspectRatioCorrectness(uploadedImage);
            });

            cy.uiCloseRHS();
        });
    });
});

function verifyImageAspectRatioCorrectness(originalImage) {
    cy.get('.post-image__thumbnail img, img.attachment-file__img, img').
        first().
        should('be.visible').
        and(($img) => {
            expect($img[0].naturalWidth, 'image finished loading').to.be.greaterThan(0);
            expect($img[0].naturalWidth / $img[0].naturalHeight).to.be.closeTo(
                originalImage.width / originalImage.height,
                0.02,
            );
        });
}
