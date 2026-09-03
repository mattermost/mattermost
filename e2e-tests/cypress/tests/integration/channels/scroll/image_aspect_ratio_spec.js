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
            cy.get('#fileUploadInput').attachFile(uploadedImage.file);
            cy.uiWaitForFileUploadPreview();
            cy.postMessage(uploadedImage.file);

            // Last post must include the upload; within() on a stale join post never recovers.
            cy.findAllByTestId('postView').last().should(($post) => {
                expect($post.find('.file-view--single').length, 'file attach').to.be.greaterThan(0);
            });

            cy.getLastPost().within(() => {
                cy.contains(uploadedImage.file).should('be.visible');
                verifyImageAspectRatioCorrectness(uploadedImage);
            });

            cy.clickPostCommentIcon();

            cy.get('#rhsContainer').within(() => {
                verifyImageAspectRatioCorrectness(uploadedImage);
            });

            cy.uiCloseRHS();
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
