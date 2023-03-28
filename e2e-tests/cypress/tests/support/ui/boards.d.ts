// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiCreateEmptyBoard`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Create a board on a given menu item.
         *
         * @param {string} item - one of the template menu options, ex. 'Empty board'
         */
        uiCreateBoard(item: string): Chainable;

        /**
         * Create an empty board.
         * @example
         *   cy.uiCreateEmptyBoard();
         */
        uiCreateEmptyBoard(): Chainable;

        /**
         * Create a board with the given title
         *
         * @param {string} title - title of the new board
         */
        uiCreateNewBoard: (title?: string) => Chainable;

        /**
         * Create a new group with the given name
         *
         * @param {string} name - name of the new group
         */
        uiAddNewGroup: (name?: string) => Chainable;

        /**
         * Create a card with the given title
         *
         * @param {string} title - title of the new card
         * @param {string} columnIndex - the column index to create the card
         */
        uiAddNewCard: (title?: string, columnIndex?: number) => Chainable;
    }
}
