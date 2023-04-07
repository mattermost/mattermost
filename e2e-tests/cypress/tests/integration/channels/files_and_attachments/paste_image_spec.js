// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @files_and_attachments

describe('Paste Image', () => {
    before(() => {
        // # Enable Link Previews
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLinkPreviews: true,
            },
        });

        // # Create new team and new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T2263 - Paste image in message box and post', () => {
        const filename = 'mattermost-icon.png';

        // # Paste image
        cy.fixture(filename).then((img) => {
            const blob = Cypress.Blob.base64StringToBlob(img, 'image/png');
            cy.uiGetPostTextBox().trigger('paste', {clipboardData: {
                items: [{
                    name: filename,
                    kind: 'file',
                    type: 'image/png',
                    getAsFile: () => {
                        return blob;
                    },
                }],
                types: [],
            }});

            cy.uiWaitForFileUploadPreview();
        });

        cy.uiGetFileUploadPreview().should('be.visible').within(() => {
            // * Type is correct
            cy.get('.post-image__type').should('contain.text', 'PNG');

            // * Size is correct
            cy.get('.post-image__size').should('contain.text', '13KB');

            // * Img thumbnail exist
            cy.get('.post-image__thumbnail > .post-image').should('exist');
        });

        // # Post message
        cy.postMessage('hello');

        cy.uiGetPostBody().
            find('.file-view--single').
            find('img').
            should(maintainAspectRatio);

        // # Open RHS
        cy.clickPostCommentIcon();

        cy.getLastPostId().then((id) => {
            cy.get(`#rhsPost_${id}`).within(() => {
                cy.get('.file-view--single').
                    find('img').
                    should(maintainAspectRatio);
            });
        });
    });
});

function maintainAspectRatio(img) {
    const aspectRatio = 1;

    // * Image aspect ratio is maintained
    expect(img.width() / img.height()).to.be.closeTo(aspectRatio, 0.01);
}
