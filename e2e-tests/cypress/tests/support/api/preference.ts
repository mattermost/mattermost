// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from 'tests/types';
import theme from '../../fixtures/theme.json';
import {PreferenceType} from '@mattermost/types/preferences';

// *****************************************************************************
// Preferences
// https://api.mattermost.com/#tag/preferences
// *****************************************************************************

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
function apiSaveUserPreference(preferences: PreferenceType[] = [], userId = 'me'): ChainableT<any> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/preferences`,
        method: 'PUT',
        body: preferences,
    });
}

Cypress.Commands.add('apiSaveUserPreference', apiSaveUserPreference);

/**
 * Save clock display mode to 24-hour preference.
 * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
 * @param {boolean} is24Hour - true (default) or false for 12-hour
 * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
 *
 * @example
 *   cy.apiSaveClockDisplayModeTo24HourPreference(true);
 */
function apiSaveClockDisplayModeTo24HourPreference(is24Hour = true): ChainableT<any> {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'use_military_time',
            value: is24Hour.toString(),
        };

        return cy.apiSaveUserPreference([preference]);
    });
}

Cypress.Commands.add('apiSaveClockDisplayModeTo24HourPreference', apiSaveClockDisplayModeTo24HourPreference);

/**
 * Saves channel display mode preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} value - Either "full" (default) or "centered"
 */
function apiSaveChannelDisplayModePreference(value = 'full') {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'channel_display_mode',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
}
Cypress.Commands.add('apiSaveChannelDisplayModePreference', apiSaveChannelDisplayModePreference);

/**
 * Saves message display preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} value - Either "clean" (default) or "compact"
 */
function apiSaveMessageDisplayPreference(value = 'clean') {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'message_display',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
}

Cypress.Commands.add('apiSaveMessageDisplayPreference', apiSaveMessageDisplayPreference);

/**
 * Saves teammate name display preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} value - Either "username" (default), "nickname_full_name" or "full_name"
 */
function apiSaveTeammateNameDisplayPreference(value = 'username') {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'name_format',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
}

Cypress.Commands.add('apiSaveTeammateNameDisplayPreference', apiSaveTeammateNameDisplayPreference);

/**
 * Saves theme preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {Object} value - theme object.  Will pass default value if none is provided.
 */
function apiSaveThemePreference(value = JSON.stringify(theme.default)) {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'theme',
            name: '',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
}

Cypress.Commands.add('apiSaveThemePreference', apiSaveThemePreference);

const defaultSidebarSettingPreference = {
    grouping: 'by_type',
    unreads_at_top: 'true',
    favorite_at_top: 'true',
    sorting: 'alpha',
};

/**
 * Saves theme preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {Object} value - sidebar settings object.  Will pass default value if none is provided.
 */
function apiSaveSidebarSettingPreference(value = {}) {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const newValue = {
            ...defaultSidebarSettingPreference,
            ...value,
        };

        const preference = {
            user_id: cookie.value,
            category: 'sidebar_settings',
            name: '',
            value: JSON.stringify(newValue),
        };

        return cy.apiSaveUserPreference([preference]);
    });
}

Cypress.Commands.add('apiSaveSidebarSettingPreference', apiSaveSidebarSettingPreference);

/**
 * Saves the preference on whether to show link and image previews
 * This API assume that the user is logged in and has cookie to access
 * @param {boolean} show - Either "true" to show link and images previews (default), or "false"
 */
function apiSaveLinkPreviewsPreference(show = 'true') {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'link_previews',
            value: show,
        };

        return cy.apiSaveUserPreference([preference]);
    });
}

Cypress.Commands.add('apiSaveLinkPreviewsPreference', apiSaveLinkPreviewsPreference);

/**
 * Saves the preference on whether to show link and image previews expanded
 * This API assume that the user is logged in and has cookie to access
 * @param {boolean} collapse - Either "true" to show previews collapsed (default), or "false"
 */
function apiSaveCollapsePreviewsPreference(collapse = 'true') {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'collapse_previews',
            value: collapse,
        };

        return cy.apiSaveUserPreference([preference]);
    });
}

Cypress.Commands.add('apiSaveCollapsePreviewsPreference', apiSaveCollapsePreviewsPreference);

/**
 * Saves tutorial step of a user
 * @param {string} userId - User ID
 * @param {string} value - value of tutorial step, e.g. '999' (default, completed tutorial)
 */
function apiSaveTutorialStep(userId: string, value = '999'): ChainableT<any> {
    const preference = {
        user_id: userId,
        category: 'tutorial_step',
        name: userId,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveTutorialStep', apiSaveTutorialStep);

function apiSaveOnboardingPreference(userId, name, value) {
    const preference = {
        user_id: userId,
        category: 'recommended_next_steps',
        name,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveOnboardingPreference', apiSaveOnboardingPreference);

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
function apiSaveDirectChannelShowPreference(userId: string, otherUserId: string, value: string): ChainableT<any> {
    const preference = {
        user_id: userId,
        category: 'direct_channel_show',
        name: otherUserId,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveDirectChannelShowPreference', apiSaveDirectChannelShowPreference);

function apiHideSidebarWhatsNewModalPreference(userId, value) {
    const preference = {
        user_id: userId,
        category: 'whats_new_modal',
        name: 'has_seen_sidebar_whats_new_modal',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiHideSidebarWhatsNewModalPreference', apiHideSidebarWhatsNewModalPreference);

/**
 * Get the full list of the user's preferences.
 * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/get
 * @param {string} userId - User ID
 * @returns {Response} response: Cypress-chainable response which should have a list of preference objects
 *
 * @example
 *   cy.apiGetUserPreference('user-id');
 */
function apiGetUserPreference(userId: string): ChainableT<any> {
    return cy.request(`/api/v4/users/${userId}/preferences`).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body);
    });
}

Cypress.Commands.add('apiGetUserPreference', apiGetUserPreference);

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
function apiSaveCRTPreference(userId: string, value = 'on'): ChainableT<any> {
    const preference = {
        user_id: userId,
        category: 'display_settings',
        name: 'collapsed_reply_threads',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveCRTPreference', apiSaveCRTPreference);

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
function apiSaveCloudTrialBannerPreference(userId: string, name: string, value: string): ChainableT<any> {
    const preference = {
        user_id: userId,
        category: 'cloud_trial_banner',
        name,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveCloudTrialBannerPreference', apiSaveCloudTrialBannerPreference);

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
function apiSaveStartTrialModal(userId: string, value = 'true'): ChainableT<any> {
    const preference = {
        user_id: userId,
        category: 'start_trial_modal',
        name: 'trial_modal_auto_shown',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveStartTrialModal', apiSaveStartTrialModal);

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
function apiSaveOnboardingTaskListPreference(userId: string, name: string, value: string): ChainableT<any> {
    const preference = {
        user_id: userId,
        category: 'onboarding_task_list',
        name,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveOnboardingTaskListPreference', apiSaveOnboardingTaskListPreference);

/**
 * Save skip steps preference.
 * @param userId - User ID
 * @param {string} value - options are 'true' or 'false'
 * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
 *
 * @example
 *   cy.apiSaveSkipStepsPreference('user-id', 'true');
 */
function apiSaveSkipStepsPreference(userId: string, value: string): ChainableT<any> {
    const preference = {
        user_id: userId,
        category: 'recommended_next_steps',
        name: 'skip',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveSkipStepsPreference', apiSaveSkipStepsPreference);

function apiSaveUnreadScrollPositionPreference(userId, value) {
    const preference = {
        user_id: userId,
        category: 'advanced_settings',
        name: 'unread_scroll_position',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveUnreadScrollPositionPreference', apiSaveUnreadScrollPositionPreference);

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
function apiSaveDraftsTourTipPreference(userId: string, value: boolean): ChainableT<any> {
    const preference = {
        user_id: userId,
        category: 'drafts',
        name: 'drafts_tour_tip_showed',
        value: JSON.stringify({drafts_tour_tip_showed: value}),
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveDraftsTourTipPreference', apiSaveDraftsTourTipPreference);

/**
 * Mark Boards welcome page as viewed.
 * See https://api.mattermost.com/#tag/preferences/paths/~1users~1{user_id}~1preferences/put
 * @param {string} userId - User ID
 * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
 *
 * @example
 *   cy.apiBoardsWelcomePageViewed('user-id');
 */
function apiBoardsWelcomePageViewed(userId: string): ChainableT<any> {
    const preferences = [{
        user_id: userId,
        category: 'boards',
        name: 'welcomePageViewed',
        value: '1',
    },
    {
        user_id: userId,
        category: 'boards',
        name: 'version72MessageCanceled',
        value: 'true',
    }];

    return cy.apiSaveUserPreference(preferences, userId);
}

Cypress.Commands.add('apiBoardsWelcomePageViewed', apiBoardsWelcomePageViewed);

/**
 * Saves Join/Leave messages preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {Boolean} enable - Either true (default) or false
 */
function apiSaveJoinLeaveMessagesPreference(userId, enable = true) {
    const preference = {
        user_id: userId,
        category: 'advanced_settings',
        name: 'join_leave',
        value: enable.toString(),
    };

    return cy.apiSaveUserPreference([preference], userId);
}

Cypress.Commands.add('apiSaveJoinLeaveMessagesPreference', apiSaveJoinLeaveMessagesPreference);

/**
 * Disables tutorials for user by marking them finished
 */
function apiDisableTutorials(userId) {
    const preferences = [
        {
            user_id: userId,
            category: 'playbook_edit',
            name: userId,
            value: '999',
        },
        {
            user_id: userId,
            category: 'tutorial_pb_run_details',
            name: userId,
            value: '999',
        },
        {
            user_id: userId,
            category: 'crt_thread_pane_step',
            name: userId,
            value: '999',
        },
        {
            user_id: userId,
            category: 'playbook_preview',
            name: userId,
            value: '999',
        },
        {
            user_id: userId,
            category: 'tutorial_step',
            name: userId,
            value: '999',
        },
        {
            user_id: userId,
            category: 'crt_tutorial_triggered',
            name: userId,
            value: '999',
        },
        {
            user_id: userId,
            category: 'crt_thread_pane_step',
            name: userId,
            value: '999',
        },
        {
            user_id: userId,
            category: 'drafts',
            name: 'drafts_tour_tip_showed',
            value: '{"drafts_tour_tip_showed":true}',
        },
        {
            user_id: userId,
            category: 'app_bar',
            name: 'channel_with_board_tip_showed',
            value: '{"channel_with_board_tip_showed":true}',
        },
    ];

    return cy.apiSaveUserPreference(preferences, userId);
}

Cypress.Commands.add('apiDisableTutorials', apiDisableTutorials);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            apiSaveUserPreference: typeof apiSaveUserPreference;
            apiSaveClockDisplayModeTo24HourPreference: typeof apiSaveClockDisplayModeTo24HourPreference;
            apiSaveChannelDisplayModePreference: typeof apiSaveChannelDisplayModePreference;
            apiSaveMessageDisplayPreference: typeof apiSaveMessageDisplayPreference;
            apiSaveTeammateNameDisplayPreference: typeof apiSaveTeammateNameDisplayPreference;
            apiSaveThemePreference: typeof apiSaveThemePreference;
            apiSaveSidebarSettingPreference: typeof apiSaveSidebarSettingPreference;
            apiSaveLinkPreviewsPreference: typeof apiSaveLinkPreviewsPreference;
            apiSaveCollapsePreviewsPreference: typeof apiSaveCollapsePreviewsPreference;
            apiSaveTutorialStep: typeof apiSaveTutorialStep;
            apiSaveOnboardingPreference: typeof apiSaveOnboardingPreference;
            apiSaveDirectChannelShowPreference: typeof apiSaveDirectChannelShowPreference;
            apiHideSidebarWhatsNewModalPreference: typeof apiHideSidebarWhatsNewModalPreference;
            apiGetUserPreference: typeof apiGetUserPreference;
            apiSaveCRTPreference: typeof apiSaveCRTPreference;
            apiSaveCloudTrialBannerPreference: typeof apiSaveCloudTrialBannerPreference;
            apiSaveStartTrialModal: typeof apiSaveStartTrialModal;
            apiSaveOnboardingTaskListPreference: typeof apiSaveOnboardingTaskListPreference;
            apiSaveSkipStepsPreference: typeof apiSaveSkipStepsPreference;
            apiSaveUnreadScrollPositionPreference: typeof apiSaveUnreadScrollPositionPreference;
            apiSaveDraftsTourTipPreference: typeof apiSaveDraftsTourTipPreference;
            apiBoardsWelcomePageViewed: typeof apiBoardsWelcomePageViewed;
            apiSaveJoinLeaveMessagesPreference: typeof apiSaveJoinLeaveMessagesPreference;
            apiDisableTutorials: typeof apiDisableTutorials;
        }
    }
}
