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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiOpenFilePreviewModal`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Create a new category
         *
         * @param [categoryName] category's name
         *
         * @example
         *   cy.uiCreateSidebarCategory();
         */
        uiCreateSidebarCategory(categoryName?: string): Chainable;

        /**
         * Move a channel to a category.
         * Open the channel menu, select Move to, and click either New Category or on the category.
         *
         * @param channelName channel's name
         * @param categoryName category's name
         * @param [newCategory=false] create a new category to move into
         * @param [isChannelId=false] whether channelName is a channel ID
         *
         * @example
         *   cy.uiMoveChannelToCategory('Town Square', 'Favorites');
         */
        uiMoveChannelToCategory(channelName: string, categoryName: string, newCategory: boolean = false, isChannelId: boolean = false): Chainable;
    }
}
