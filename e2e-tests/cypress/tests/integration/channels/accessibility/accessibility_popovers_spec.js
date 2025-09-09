// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @accessibility

let previousEmoji = 'grinning';

function verifyArrowKeysEmojiNavigation(arrowKey, count) {
    for (let index = 0; index < count; index++) {
        cy.get('body').type(arrowKey);

        cy.get('.emoji-picker__preview-name').invoke('text').then((selectedEmoji) => {
            expect(selectedEmoji).not.equal(previousEmoji);
            previousEmoji = selectedEmoji;
        });
    }
}

describe('Verify Accessibility Support in Popovers', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);

            // # Post a message
            cy.postMessage(`hello from test user: ${Date.now()}`);
        });
    });

    it('MM-T1489 Accessibility Support in Emoji Popover on click of Emoji Reaction button', () => {
        cy.getLastPostId().then((postId) => {
            // # Open the Emoji Popover
            cy.clickPostReactionIcon(postId);

            // * Verify accessibility support in Emoji Search input
            cy.get('#emojiPickerSearch').should('have.attr', 'aria-label', 'Search for an emoji');

            // # Focus on the first emoji Category
            cy.get('#emojiPickerCategories').children().eq(0).focus().tab({shift: true}).tab();

            const categories = [
                {ariaLabel: 'Smileys & Emotion', header: 'Smileys & Emotion'},
                {ariaLabel: 'People & Body', header: 'People & Body'},
                {ariaLabel: 'Animals & Nature', header: 'Animals & Nature'},
                {ariaLabel: 'Food & Drink', header: 'Food & Drink'},
                {ariaLabel: 'Travel Places', header: 'Travel Places'},
                {ariaLabel: 'Activities', header: 'Activities'},
                {ariaLabel: 'Objects', header: 'Objects'},
                {ariaLabel: 'Symbols', header: 'Symbols'},
                {ariaLabel: 'Flags', header: 'Flags'},
            ];

            // * Verify if emoji Categories gets the focus when tab is pressed
            cy.get('#emojiPickerCategories').children('.emoji-picker__category').each(($el, index) => {
                // * Verify each category
                if (index < categories.length) {
                    // * Verify accessibility support in emoji category
                    cy.get($el).should('have.class', 'a11y--active a11y--focused').should('have.attr', 'aria-label', categories[index].ariaLabel);

                    // * Verify if corresponding section is displayed when emoji category has focus and clicked
                    cy.get($el).trigger('click').tab();

                    // * Verify if corresponding section is displayed
                    cy.findByText(categories[index].header).should('be.visible');

                    // * Verify emoji navigation using arrow keys
                    verifyArrowKeysEmojiNavigation('{rightarrow}', 3);
                    verifyArrowKeysEmojiNavigation('{leftarrow}', 2);

                    // # Press tab
                    cy.get($el).focus().tab();
                }
            });

            // # Close the Emoji Popover
            cy.get('body').click();
        });
    });
});
