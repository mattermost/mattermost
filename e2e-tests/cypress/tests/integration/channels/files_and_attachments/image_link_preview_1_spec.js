// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @files_and_attachments

describe('Image Link Preview', () => {
    let offTopicUrl;

    before(() => {
        // # Enable Link Previews
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLinkPreviews: true,
            },
        });

        // # Create new team and new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            offTopicUrl = out.offTopicUrl;

            // # Enable link previews
            cy.apiSaveLinkPreviewsPreference('true');

            cy.visit(offTopicUrl);
        });
    });

    beforeEach(() => {
        // # Expand image previews
        cy.apiSaveCollapsePreviewsPreference('false');
    });

    it('MM-T332 Image link preview - Bitly links for images and YouTube -- KNOWN ISSUE: MM-40448', () => {
        // # Youtube link and image link
        const links = ['https://bit.ly/2NlYsOr', 'https://bit.ly/2wqEbjw'];

        links.forEach((link) => {
            // # Post a link to an externally hosted image
            cy.postMessage(link);

            cy.getLastPostId().then((postId) => {
                // * Verify it renders correctly on center
                cy.get(`#post_${postId}`).should('be.visible').within(() => {
                    cy.findByLabelText('Toggle Embed Visibility').
                        should('be.visible').and('have.attr', 'data-expanded', 'true');
                    cy.findByLabelText('file thumbnail').should('be.visible');
                });

                // # Click the collapse arrows to collapse the image preview
                cy.get(`#post_${postId}`).findByLabelText('Toggle Embed Visibility').
                    click().
                    should('have.attr', 'data-expanded', 'false');

                // * Observe it collapses
                cy.get(`#post_${postId}`).findByLabelText('file thumbnail').should('not.exist');

                // # Click the expand arrows to expand the image preview again
                cy.get(`#post_${postId}`).findByLabelText('Toggle Embed Visibility').
                    click().
                    should('have.attr', 'data-expanded', 'true');

                // * Observe it expand
                cy.get(`#post_${postId}`).findByLabelText('file thumbnail').should('be.visible');
            });
        });
    });
});
