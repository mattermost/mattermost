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
                alt: 'Wide image',
                width: 960,
                height: 246,
                src:
                    'https://cdn.pixabay.com/photo/2017/10/10/22/24/wide-format-2839089_960_720.jpg',
            },
            {
                alt: 'Tall image',
                width: 400,
                height: 950,
                src:
                    'https://media.npr.org/programs/atc/features/2009/may/short/abetall3-0483922b5fb40887fc9fbe20a606e256cbbd10ee-s800-c85.jpg',
            },
        ];

        uploadedImages.forEach((uploadedImage) => {
            // # Post the image as markdown image in the center
            cy.uiPostMessageQuickly(`![${uploadedImage.alt}](${uploadedImage.src})`);

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
        });
    });
});

function verifyImageAspectRatioCorrectness(originalImage) {
    cy.findByAltText(originalImage.alt).
        should('exist').
        and((img) => {
            expect(img.width() / img.height()).to.be.closeTo(
                originalImage.width / originalImage.height,
                0.02,
            );
        });
}
