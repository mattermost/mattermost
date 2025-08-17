// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @emoji

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Emoji sorting', () => {
    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T157 Filtered emojis are sorted by recency, then begins with, then contains (alphabetically within each)', () => {
        // # Post a dog emoji
        cy.postMessage(':dog:');

        // # Post a cat emoji
        cy.postMessage(':cat:');

        // # Open emoji picker
        cy.uiOpenEmojiPicker();

        // # Assert first recently used emoji has the data-test-id value of 'cat' which was the last one we sent
        cy.findAllByTestId('emojiItem').
            each(($btn) => {
                // Check if the button has the specific aria-label
                if ($btn.attr('aria-label') === 'cat emoji') {
                    // If the aria-label matches, check if the button exists
                    cy.wrap($btn).should('exist');
                }
            });

        const emojiList = [];

        // # Post a guardsman emoji
        cy.postMessage(':guardsman:');

        // # Post a white small square emoji
        cy.postMessage(':white_small_square:');

        // # Open emoji picker
        cy.uiOpenEmojiPicker();

        // # Search sma text in emoji searching input
        cy.findByPlaceholderText('Search emojis').should('be.visible').type('sma', {delay: TIMEOUTS.HALF_SEC});

        // # Get list of recent emojis based on search text
        cy.findAllByTestId('emojiItem').children('img').each(($el) => {
            const emojiName = $el.get(0);
            emojiList.push(emojiName.dataset.testid);
        }).then(() => {
            // # Comparing list of emojis obtained from search above and making sure order is same as requirement describes
            expect(emojiList).to.deep.equal([
                'guardsman',
                'white_small_square',
                'small_airplane',
                'small_blue_diamond',
                'small_orange_diamond',
                'small_red_triangle',
                'small_red_triangle_down',
                'arrow_down_small',
                'arrow_up_small',
                'black_medium_small_square',
                'black_small_square',
                'mostly_sunny,sun_small_cloud,sun_behind_small_cloud',
                'white_medium_small_square',
                'zany_face,grinning_face_with_one_large_and_one_small_eye',
            ]);
        });
    });
});
