// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import theme from '../../fixtures/theme.json';

// *****************************************************************************
// Preferences
// https://api.mattermost.com/#tag/preferences
// *****************************************************************************

/**
 * Saves user's preference directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {Array} preference - a list of user's preferences
 */
Cypress.Commands.add('apiSaveUserPreference', (preferences = [], userId = 'me') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/preferences`,
        method: 'PUT',
        body: preferences,
    });
});

/**
 * Saves clock display mode 24-hour preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {Boolean} is24Hour - Either true (default) or false
 */
Cypress.Commands.add('apiSaveClockDisplayModeTo24HourPreference', (is24Hour = true) => {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'use_military_time',
            value: is24Hour.toString(),
        };

        return cy.apiSaveUserPreference([preference]);
    });
});

/**
 * Saves channel display mode preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} value - Either "full" (default) or "centered"
 */
Cypress.Commands.add('apiSaveChannelDisplayModePreference', (value = 'full') => {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'channel_display_mode',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
});

/**
 * Saves message display preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} value - Either "clean" (default) or "compact"
 */
Cypress.Commands.add('apiSaveMessageDisplayPreference', (value = 'clean') => {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'message_display',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
});

/**
 * Saves show markdown preview option preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} value - Either "true" to show the options (default) or "false"
 */
Cypress.Commands.add('apiSaveShowMarkdownPreviewPreference', (value = 'true') => {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'advanced_settings',
            name: 'feature_enabled_markdown_preview',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
});

/**
 * Saves teammate name display preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} value - Either "username" (default), "nickname_full_name" or "full_name"
 */
Cypress.Commands.add('apiSaveTeammateNameDisplayPreference', (value = 'username') => {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'name_format',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
});

/**
 * Saves theme preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {Object} value - theme object.  Will pass default value if none is provided.
 */
Cypress.Commands.add('apiSaveThemePreference', (value = JSON.stringify(theme.default)) => {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'theme',
            name: '',
            value,
        };

        return cy.apiSaveUserPreference([preference]);
    });
});

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
Cypress.Commands.add('apiSaveSidebarSettingPreference', (value = {}) => {
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
});

/**
 * Saves the preference on whether to show link and image previews
 * This API assume that the user is logged in and has cookie to access
 * @param {boolean} show - Either "true" to show link and images previews (default), or "false"
 */
Cypress.Commands.add('apiSaveLinkPreviewsPreference', (show = 'true') => {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'link_previews',
            value: show,
        };

        return cy.apiSaveUserPreference([preference]);
    });
});

/**
 * Saves the preference on whether to show link and image previews expanded
 * This API assume that the user is logged in and has cookie to access
 * @param {boolean} collapse - Either "true" to show previews collapsed (default), or "false"
 */
Cypress.Commands.add('apiSaveCollapsePreviewsPreference', (collapse = 'true') => {
    return cy.getCookie('MMUSERID').then((cookie) => {
        const preference = {
            user_id: cookie.value,
            category: 'display_settings',
            name: 'collapse_previews',
            value: collapse,
        };

        return cy.apiSaveUserPreference([preference]);
    });
});

/**
 * Saves tutorial step of a user
 * This API assume that the user is logged in and has cookie to access
 * @param {string} value - value of tutorial step, e.g. '999' (default, completed tutorial)
 */
Cypress.Commands.add('apiSaveTutorialStep', (userId, value = '999') => {
    const preference = {
        user_id: userId,
        category: 'tutorial_step',
        name: userId,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveOnboardingPreference', (userId, name, value) => {
    const preference = {
        user_id: userId,
        category: 'recommended_next_steps',
        name,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveDirectChannelShowPreference', (userId, otherUserId, value) => {
    const preference = {
        user_id: userId,
        category: 'direct_channel_show',
        name: otherUserId,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiHideSidebarWhatsNewModalPreference', (userId, value) => {
    const preference = {
        user_id: userId,
        category: 'whats_new_modal',
        name: 'has_seen_sidebar_whats_new_modal',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiGetUserPreference', (userId) => {
    return cy.request(`/api/v4/users/${userId}/preferences`).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body);
    });
});

Cypress.Commands.add('apiSaveCRTPreference', (userId, value = 'on') => {
    const preference = {
        user_id: userId,
        category: 'display_settings',
        name: 'collapsed_reply_threads',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveCloudTrialBannerPreference', (userId, name, value) => {
    const preference = {
        user_id: userId,
        category: 'cloud_trial_banner',
        name,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveActionsMenuPreference', (userId, value = true) => {
    const preference = {
        user_id: userId,
        category: 'actions_menu',
        name: 'actions_menu_tutorial_state',
        value: JSON.stringify({actions_menu_modal_viewed: value}),
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveStartTrialModal', (userId, value = 'true') => {
    const preference = {
        user_id: userId,
        category: 'start_trial_modal',
        name: 'trial_modal_auto_shown',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveOnboardingTaskListPreference', (userId, name, value) => {
    const preference = {
        user_id: userId,
        category: 'onboarding_task_list',
        name,
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveSkipStepsPreference', (userId, value) => {
    const preference = {
        user_id: userId,
        category: 'recommended_next_steps',
        name: 'skip',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveUnreadScrollPositionPreference', (userId, value) => {
    const preference = {
        user_id: userId,
        category: 'advanced_settings',
        name: 'unread_scroll_position',
        value,
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiSaveDraftsTourTipPreference', (userId, value) => {
    const preference = {
        user_id: userId,
        category: 'drafts',
        name: 'drafts_tour_tip_showed',
        value: JSON.stringify({drafts_tour_tip_showed: value}),
    };

    return cy.apiSaveUserPreference([preference], userId);
});

Cypress.Commands.add('apiBoardsWelcomePageViewed', (userId) => {
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
});

/**
 * Saves Join/Leave messages preference of a user directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {Boolean} enable - Either true (default) or false
 */
Cypress.Commands.add('apiSaveJoinLeaveMessagesPreference', (userId, enable = true) => {
    const preference = {
        user_id: userId,
        category: 'advanced_settings',
        name: 'join_leave',
        value: enable.toString(),
    };

    return cy.apiSaveUserPreference([preference], userId);
});

/**
 * Disables tutorials for user by marking them finished
 */
Cypress.Commands.add('apiDisableTutorials', (userId) => {
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
            category: 'actions_menu',
            name: 'actions_menu_tutorial_state',
            value: '{"actions_menu_modal_viewed":true}',
        },
        {
            user_id: userId,
            category: 'insights',
            name: 'insights_tutorial_state',
            value: '{"insights_modal_viewed":true}',
        },
        {
            user_id: userId,
            category: 'drafts',
            name: 'drafts_tour_tip_showed',
            value: '{"drafts_tour_tip_showed":true}',
        },
    ];

    return cy.apiSaveUserPreference(preferences, userId);
});
