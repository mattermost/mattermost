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

        // *******************************************************************************
        // Preferences
        // https://api.mattermost.com/#tag/preferences
        // *******************************************************************************

        /**
         * Save a list of the user's preferences.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {PreferenceType[]} preferences - List of preference objects
         * @param {string} userId - User ID
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveUserPreference([{user_id: 'user-id', category: 'display_settings', name: 'channel_display_mode', value: 'full'}], 'user-id');
         */
        apiSaveUserPreference(preferences: PreferenceType[], userId: string): Chainable<Response>;

        /**
         * Get the full list of the user's preferences.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/get
         * @param {string} userId - User ID
         * @returns {Response} response: Cypress-chainable response which should have a list of preference objects
         *
         * @example
         *   cy.apiGetUserPreference('user-id');
         */
        apiGetUserPreference(userId: string): Chainable<Response>;

        /**
         * Save clock display mode to 24-hour preference.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {boolean} is24Hour - true (default) or false for 12-hour
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveClockDisplayModeTo24HourPreference(true);
         */
        apiSaveClockDisplayModeTo24HourPreference(is24Hour: boolean): Chainable<Response>;

        /**
         * Save onboarding tasklist preference.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {string} userId - User ID
         * @param {string} name - options are complete_profile, team_setup, invite_members or hide
         * @param {string} value - options are 'true' or 'false'
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveOnboardingTaskListPreference('user-id', 'hide', 'true');
         */
        apiSaveOnboardingTaskListPreference(userId: string, name: string, value: string): Chainable<Response>;

        /**
         * Save DM channel show preference.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {string} userId - User ID
         * @param {string} otherUserId - Other user in a DM channel
         * @param {string} value - options are 'true' or 'false'
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveDirectChannelShowPreference('user-id', 'other-user-id', 'false');
         */
        apiSaveDirectChannelShowPreference(userId: string, otherUserId: string, value: string): Chainable<Response>;

        /**
         * Save Collapsed Reply Threads preference.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {string} userId - User ID
         * @param {string} value - options are 'on' or 'off'
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveCRTPreference('user-id', 'on');
         */
        apiSaveCRTPreference(userId: string, value: string): Chainable<Response>;

        /**
         * Saves tutorial step of a user
         * @param {string} userId - User ID
         * @param {string} value - value of tutorial step, e.g. '999' (default, completed tutorial)
         */
        apiSaveTutorialStep(userId: string, value: string): Chainable<Response>;

        /**
         * Save cloud trial banner preference.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {string} userId - User ID
         * @param {string} name - options are trial or hide
         * @param {string} value - options are 'max_days_banner' or '3_days_banner' for trial, and 'true' or 'false' for hide
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveCloudTrialBannerPreference('user-id', 'hide', 'true');
         */
        apiSaveCloudTrialBannerPreference(userId: string, name: string, value: string): Chainable<Response>;

        /**
         * Save actions menu preference.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {string} userId - User ID
         * @param {string} value - true (default) or false
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveActionsMenuPreference('user-id', true);
         */
        apiSaveActionsMenuPreference(userId: string, value: boolean): Chainable<Response>;

        /**
         * Save show trial modal.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {string} userId - User ID
         * @param {string} name - trial_modal_auto_shown
         * @param {string} value - values are 'true' or 'false'
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveStartTrialModal('user-id', 'true');
         */
        apiSaveStartTrialModal(userId: string, value: string): Chainable<Response>;

        /**
         * Save drafts tour tip preference.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {string} userId - User ID
         * @param {string} value - values are 'true' or 'false'
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiSaveDraftsTourTipPreference('user-id', 'true');
         */
        apiSaveDraftsTourTipPreference(userId: string, value: boolean): Chainable<Response>;

        /**
         * Mark Boards welcome page as viewed.
         * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
         * @param {string} userId - User ID
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiBoardsWelcomePageViewed('user-id');
         */
        apiBoardsWelcomePageViewed(userId: string): Chainable<Response>;
    }
}
