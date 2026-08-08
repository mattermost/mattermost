// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from 'tests/types';

Cypress.Commands.add('uiGetEmojiPicker', (): ChainableT<JQuery> => {
    return cy.get('#emojiPicker').should('be.visible');
});

Cypress.Commands.add('uiOpenEmojiPicker', (): ChainableT<JQuery> => {
    cy.findByRole('button', {name: 'select an emoji'}).click();
    return cy.get('#emojiPicker').should('be.visible');
});

Cypress.Commands.add('uiOpenCustomEmoji', () => {
    cy.uiOpenEmojiPicker();
    cy.findByText('Custom Emoji').should('be.visible').click();

    cy.url().should('include', '/emoji');
    cy.get('.backstage-header').should('be.visible').and('contain', 'Custom Emoji');
});

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Open custom emoji
             *
             * @example
             *   cy.uiOpenCustomEmoji();
             */
            uiGetEmojiPicker(): Chainable;

            /**
             * Open custom emoji
             *
             * @example
             *   cy.uiOpenCustomEmoji();
             */
            uiOpenCustomEmoji(): Chainable;

            /**
             * Open emoji picker
             *
             * @example
             *   cy.uiOpenEmojiPicker();
             */
            uiOpenEmojiPicker(): Chainable;
        }
    }
}
