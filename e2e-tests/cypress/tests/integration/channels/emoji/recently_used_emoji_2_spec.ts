// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @emoji @timeout_error

import * as TIMEOUTS from '../../../fixtures/timeouts';
import * as MESSAGES from '../../../fixtures/messages';

describe('Recent Emoji', () => {
    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableCustomEmoji: true,
            },
        });

        cy.apiInitSetup().then(({team, user}) => {
            cy.apiLogin(user);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T4438 Changing the skin of emojis should apply the same skin to emojis in recent section', () => {
        // # Post a sample message
        cy.postMessage(MESSAGES.TINY);

        // # Post reaction to post
        cy.clickPostReactionIcon();

        cy.get('#emojiPicker').should('be.visible').within(() => {
            // # Open skin picker
            cy.findByAltText('emoji skin tone picker').should('exist').parent().click().wait(TIMEOUTS.ONE_SEC);

            // # Select default yellow skin
            cy.findByTestId('skin-pick-default').should('exist').click();

            // # Search for a system emoji with skin
            cy.findByPlaceholderText('Search emojis').should('exist').type('thumbsup').wait(TIMEOUTS.HALF_SEC);

            // # Select the emoji to add to post with default skin
            cy.findByTestId('+1,thumbsup').parent().click();
        });

        // # Open emoji picker again to check if thumbsup emoji is present in recent section
        cy.uiOpenEmojiPicker().wait(TIMEOUTS.TWO_SEC);

        cy.get('#emojiPicker').should('be.visible').within(() => {
            // * Verify recently used category is present in emoji picker
            cy.findByText('Recently Used').should('exist').and('be.visible');

            // * Verify most recent one is the thumbsup emoji with default skin
            cy.findAllByTestId('emojiItem').eq(0).find('img').should('have.attr', 'aria-label', '+1 emoji');

            // # Open skin picker again to change the skin
            cy.findByAltText('emoji skin tone picker').should('exist').parent().click().wait(TIMEOUTS.ONE_SEC);

            // # Select a dark skin tone
            cy.findByTestId('skin-pick-1F3FF').should('exist').click();

            // * Verify most recent one is the same thumbsup emoji but now with a dark skin tone
            cy.findAllByTestId('emojiItem').eq(0).find('img').should('have.attr', 'aria-label', '+1 dark skin tone emoji');
        });

        // # Close emoji picker
        cy.get('body').type('{esc}', {force: true});
    });
});
