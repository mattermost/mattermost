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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiCreateChannel`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Create a new channel in the current team.
         * @param {string} options.prefix - Prefix for the name of the channel, it will be added a random string ot it.
         * @param {boolean} options.isPrivate - is the channel private or public (default)?
         * @param {string} options.purpose - Channel's purpose
         * @param {string} options.header - Channel's header
         * @param {boolean} options.isNewSidebar) - the new sidebar has a different ui flow, set this setting to true to use that. Defaults to false.
         * @param {string} options.createBoard) - Board template to create
         *
         * @example
         *   cy.uiCreateChannel({prefix: 'private-channel-', isPrivate: true, purpose: 'my private channel', header: 'my private header', isNewSidebar: false});
         */
        uiCreateChannel(options: Record<string, unknown>): Chainable;

        /**
         * Add users to the current channel.
         * @param {string[]} usernameList - list of userids to add to the channel
         *
         * @example
         *   cy.uiAddUsersToCurrentChannel(['user1', 'user2']);
         */
        uiAddUsersToCurrentChannel(usernameList: string[]);

        /**
         * Archive the current channel.
         *
         * @example
         *   cy.uiArchiveChannel();
         */
        uiArchiveChannel();

        /**
         * Unarchive the current channel.
         *
         * @example
         *   cy.uiUnarchiveChannel();
         */
        uiUnarchiveChannel();

        /**
         * Leave the current channel.
         * @param {boolean} isPrivate - is the channel private or public (default)?
         *
         * @example
         *   cy.uiLeaveChannel(true);
         */
        uiLeaveChannel(isPrivate?: boolean);
    }
}
