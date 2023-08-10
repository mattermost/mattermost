// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';

import {General, Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig, getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';
import {createShallowSelector} from 'mattermost-redux/utils/helpers';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import {setThemeDefaults} from 'mattermost-redux/utils/theme_utils';

import type {PreferenceType} from '@mattermost/types/preferences';
import type {GlobalState} from '@mattermost/types/store';

export function getMyPreferences(state: GlobalState): { [x: string]: PreferenceType } {
    return state.entities.preferences.myPreferences;
}

export function get(state: GlobalState, category: string, name: string, defaultValue: any = '') {
    const key = getPreferenceKey(category, name);
    const prefs = getMyPreferences(state);

    if (!(key in prefs)) {
        return defaultValue;
    }

    return prefs[key].value;
}

export function getBool(state: GlobalState, category: string, name: string, defaultValue = false): boolean {
    const value = get(state, category, name, String(defaultValue));
    return value !== 'false';
}

export function getInt(state: GlobalState, category: string, name: string, defaultValue = 0): number {
    const value = get(state, category, name, defaultValue);
    return parseInt(value, 10);
}

export function makeGetCategory(): (state: GlobalState, category: string) => PreferenceType[] {
    return createSelector(
        'makeGetCategory',
        getMyPreferences,
        (state: GlobalState, category: string) => category,
        (preferences, category) => {
            const prefix = category + '--';
            const prefsInCategory: PreferenceType[] = [];

            for (const key in preferences) {
                if (key.startsWith(prefix)) {
                    prefsInCategory.push(preferences[key]);
                }
            }

            return prefsInCategory;
        },
    );
}

const getDirectShowCategory = makeGetCategory();

export function getDirectShowPreferences(state: GlobalState) {
    return getDirectShowCategory(state, Preferences.CATEGORY_DIRECT_CHANNEL_SHOW);
}

const getGroupShowCategory = makeGetCategory();

export function getGroupShowPreferences(state: GlobalState) {
    return getGroupShowCategory(state, Preferences.CATEGORY_GROUP_CHANNEL_SHOW);
}

export const getTeammateNameDisplaySetting: (state: GlobalState) => string = createSelector(
    'getTeammateNameDisplaySetting',
    getConfig,
    getMyPreferences,
    getLicense,
    (config, preferences, license) => {
        const useAdminTeammateNameDisplaySetting = (license && license.LockTeammateNameDisplay === 'true') && config.LockTeammateNameDisplay === 'true';
        const key = getPreferenceKey(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.NAME_NAME_FORMAT);
        if (preferences[key] && !useAdminTeammateNameDisplaySetting) {
            return preferences[key].value || '';
        } else if (config.TeammateNameDisplay) {
            return config.TeammateNameDisplay;
        }
        return General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME;
    },
);

const getThemePreference = createSelector(
    'getThemePreference',
    getMyPreferences,
    (state) => state.entities.teams.currentTeamId,
    (myPreferences, currentTeamId) => {
        // Prefer the user's current team-specific theme over the user's current global theme
        let themePreference;

        if (currentTeamId) {
            themePreference = myPreferences[getPreferenceKey(Preferences.CATEGORY_THEME, currentTeamId)];
        }

        if (!themePreference) {
            themePreference = myPreferences[getPreferenceKey(Preferences.CATEGORY_THEME, '')];
        }

        return themePreference;
    },
);

export type ThemeKey = 'denim' | 'sapphire' | 'quartz' | 'indigo' | 'onyx';

export type LegacyThemeType = 'Mattermost' | 'Organization' | 'Mattermost Dark' | 'Windows Dark';

export type ThemeType = 'Denim' | 'Sapphire' | 'Quartz' | 'Indigo' | 'Onyx';

export type Theme = {
    [key: string]: string | undefined;
    type?: ThemeType | 'custom';
    sidebarBg: string;
    sidebarText: string;
    sidebarUnreadText: string;
    sidebarTextHoverBg: string;
    sidebarTextActiveBorder: string;
    sidebarTextActiveColor: string;
    sidebarHeaderBg: string;
    sidebarTeamBarBg: string;
    sidebarHeaderTextColor: string;
    onlineIndicator: string;
    awayIndicator: string;
    dndIndicator: string;
    mentionBg: string;
    mentionBj: string;
    mentionColor: string;
    centerChannelBg: string;
    centerChannelColor: string;
    newMessageSeparator: string;
    linkColor: string;
    buttonBg: string;
    buttonColor: string;
    errorTextColor: string;
    mentionHighlightBg: string;
    mentionHighlightLink: string;
    codeTheme: string;
};

const getDefaultTheme = createSelector('getDefaultTheme', getConfig, (config): Theme => {
    if (config.DefaultTheme && config.DefaultTheme in Preferences.THEMES) {
        const theme: Theme = Preferences.THEMES[config.DefaultTheme as ThemeKey];
        if (theme) {
            return theme;
        }
    }

    // If no config.DefaultTheme or value doesn't refer to a valid theme name...
    return Preferences.THEMES.denim;
});

export const getTheme: (state: GlobalState) => Theme = createShallowSelector(
    'getTheme',
    getThemePreference,
    getDefaultTheme,
    (themePreference, defaultTheme): Theme => {
        const themeValue: Theme | string = themePreference?.value ?? defaultTheme;

        // A custom theme will be a JSON-serialized object stored in a preference
        // At this point, the theme should be a plain object
        const theme: Theme = typeof themeValue === 'string' ? JSON.parse(themeValue) : themeValue;

        return setThemeDefaults(theme);
    },
);

export function makeGetStyleFromTheme<Style>(): (state: GlobalState, getStyleFromTheme: (theme: Theme) => Style) => Style {
    return createSelector(
        'makeGetStyleFromTheme',
        getTheme,
        (state: GlobalState, getStyleFromTheme: (theme: Theme) => Style) => getStyleFromTheme,
        (theme, getStyleFromTheme) => {
            return getStyleFromTheme(theme);
        },
    );
}

// shouldShowUnreadsCategory returns true if the user has unereads grouped separately with the new sidebar enabled.
export const shouldShowUnreadsCategory: (state: GlobalState) => boolean = createSelector(
    'shouldShowUnreadsCategory',
    (state: GlobalState) => get(state, Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION),
    (state: GlobalState) => get(state, Preferences.CATEGORY_SIDEBAR_SETTINGS, ''),
    (state: GlobalState) => getConfig(state).ExperimentalGroupUnreadChannels,
    (userPreference, oldUserPreference, serverDefault) => {
        // Prefer the show_unread_section user preference over the previous version
        if (userPreference) {
            return userPreference === 'true';
        }

        if (oldUserPreference) {
            return JSON.parse(oldUserPreference).unreads_at_top === 'true';
        }

        // The user setting is not set, so use the system default
        return serverDefault === General.DEFAULT_ON;
    },
);

export function getUnreadScrollPositionPreference(state: GlobalState): string {
    return get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.UNREAD_SCROLL_POSITION, Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT);
}

export function getCollapsedThreadsPreference(state: GlobalState): string {
    const configValue = getConfig(state)?.CollapsedThreads;
    let preferenceDefault = Preferences.COLLAPSED_REPLY_THREADS_OFF;

    if (configValue === CollapsedThreads.DEFAULT_ON || configValue === CollapsedThreads.ALWAYS_ON) {
        preferenceDefault = Preferences.COLLAPSED_REPLY_THREADS_ON;
    }

    return get(
        state,
        Preferences.CATEGORY_DISPLAY_SETTINGS,
        Preferences.COLLAPSED_REPLY_THREADS,
        preferenceDefault,
    );
}

export function isCollapsedThreadsAllowed(state: GlobalState): boolean {
    return Boolean(getConfig(state)) && getConfig(state).CollapsedThreads !== undefined && getConfig(state).CollapsedThreads !== CollapsedThreads.DISABLED;
}

export function isCollapsedThreadsEnabled(state: GlobalState): boolean {
    const isAllowed = isCollapsedThreadsAllowed(state);
    const userPreference = getCollapsedThreadsPreference(state);

    return isAllowed && (userPreference === Preferences.COLLAPSED_REPLY_THREADS_ON || getConfig(state).CollapsedThreads === CollapsedThreads.ALWAYS_ON);
}

export function isGroupChannelManuallyVisible(state: GlobalState, channelId: string): boolean {
    return getBool(state, Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channelId, false);
}

export function isCustomGroupsEnabled(state: GlobalState): boolean {
    return getConfig(state).EnableCustomGroups === 'true';
}

export function getIsOnboardingFlowEnabled(state: GlobalState): boolean {
    return getConfig(state).EnableOnboardingFlow === 'true';
}

export function isGraphQLEnabled(state: GlobalState): boolean {
    return getFeatureFlagValue(state, 'GraphQL') === 'true';
}

export function getHasDismissedSystemConsoleLimitReached(state: GlobalState): boolean {
    return getBool(state, Preferences.CATEGORY_UPGRADE_CLOUD, Preferences.SYSTEM_CONSOLE_LIMIT_REACHED, false);
}

export function syncedDraftsAreAllowed(state: GlobalState): boolean {
    return getConfig(state).AllowSyncedDrafts === 'true';
}

export function syncedDraftsAreAllowedAndEnabled(state: GlobalState): boolean {
    const isConfiguredForFeature = getConfig(state).AllowSyncedDrafts === 'true';
    const isConfiguredForUser = getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_SYNC_DRAFTS, true);

    return isConfiguredForFeature && isConfiguredForUser;
}

export function getVisibleDmGmLimit(state: GlobalState) {
    const defaultLimit = 40;
    return getInt(state, Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS, defaultLimit);
}

export function onboardingTourTipsEnabled(state: GlobalState): boolean {
    return getFeatureFlagValue(state, 'OnboardingTourTips') === 'true';
}

export function deprecateCloudFree(state: GlobalState): boolean {
    return getFeatureFlagValue(state, 'DeprecateCloudFree') === 'true';
}

export function cloudReverseTrial(state: GlobalState): boolean {
    return getFeatureFlagValue(state, 'CloudReverseTrial') === 'true';
}
