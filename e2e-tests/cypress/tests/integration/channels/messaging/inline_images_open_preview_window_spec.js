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
        // # Login as new user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T187 Inline markdown images open preview window', () => {
        const message = 'Hello ![test image](https://raw.githubusercontent.com/mattermost/mattermost/master/e2e-tests/cypress/tests/fixtures/image-small-height.png)';

        // # Post the message using basic input approach that was working
        cy.get('input, textarea, [contenteditable]').first().should('be.visible').clear().type(message + '{enter}');

        // * Wait for the message to appear in the post content (not sr-only elements)
        cy.get('.post-message__text').contains('Hello', {timeout: 10000}).should('be.visible');

        // * Check for the markdown inline image container
        cy.get('.markdown-inline-img__container', {timeout: 5000}).should('be.visible');

        // * Look for the image that should be clickable to open preview
        cy.get('.markdown-inline-img__container .markdown-inline-img', {timeout: 5000}).first().should('be.visible').click();

        // * Confirm image preview modal opens
        cy.findByTestId('imagePreview', {timeout: 10000}).should('be.visible');
    });
});
