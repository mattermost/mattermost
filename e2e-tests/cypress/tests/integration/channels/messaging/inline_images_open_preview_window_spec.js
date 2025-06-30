// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit the newly created test channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            // # Visit a test channel
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T187 Inline markdown images open preview window', () => {
        const message = 'Hello ![test image](https://raw.githubusercontent.com/mattermost/mattermost/master/e2e-tests/cypress/tests/fixtures/image-small-height.png)';
        
        // # Post the image link to the channel
        // Handle both post list implementations - check for the newer one first, fallback to the older one
        cy.get('body').then(($body) => {
            if ($body.find('#virtualizedPostListContent').length > 0) {
                cy.get('#virtualizedPostListContent').should('be.visible');
            } else {
                cy.get('#postListContent').should('be.visible');
            }
        });
        
        // # Type and post the message
        cy.get('#post_textbox').should('be.visible').clear().type(message).type('{enter}');

        // * Confirm the image container is visible
        cy.uiWaitUntilMessagePostedIncludes('Hello');
        cy.get('.markdown-inline-img__container').should('be.visible');

        // # Hover over image then click to open preview image
        cy.get('.file-preview__button').trigger('mouseover').click();

        // * Confirm image is visible
        cy.findByTestId('imagePreview').should('be.visible');
    });
});
