// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Update status of a current user.
         * See https://api.mattermost.com/#tag/status/paths/~1users~1{user_id}~1status/put
         * @param {String} status - "online" (default), "offline", "away" or "dnd"
         * @returns {UserStatus} `out.status` as `UserStatus`
         *
         * @example
         *   cy.apiUpdateUserStatus('offline').then(({status}) => {
         *       // do something with status
         *   });
         */
        apiUpdateUserStatus(status: string): Chainable<UserStatus>;

        /**
         * Get status of a current user.
         * See https://api.mattermost.com/#tag/status/paths/~1users~1{user_id}~1status/get
         * @param {String} userId - ID of a given user
         * @returns {UserStatus} `out.status` as `UserStatus`
         *
         * @example
         *   cy.apiGetUserStatus('userId').then(({status}) => {
         *       // examine the status information of the user
         *   });
         */
        apiGetStatus(userId: string): Chainable<UserStatus>;

        /**
         * Update custom status of current user.
         * See https://api.mattermost.com/#tag/custom_status/paths/~1users~1{user_id}~1status/custom/put
         * @param {UserCustomStatus} customStatus - custom status to be updated
         *
         * @example
         *   cy.apiUpdateUserCustomStatus({emoji: 'calendar', text: 'In a meeting'});
         */
        apiUpdateUserCustomStatus(customStatus: UserCustomStatus);

        /**
         * Clear custom status of the current user.
         * See https://api.mattermost.com/#tag/custom_status/paths/~1users~1{user_id}~1status/custom/delete
         * @param {UserCustomStatus} customStatus - custom status to be updated
         *
         * @example
         *   cy.apiClearUserCustomStatus();
         */
        apiClearUserCustomStatus();
    }
}
