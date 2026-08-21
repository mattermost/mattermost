// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import store from 'stores/redux_store';

import {Preferences} from 'utils/constants';
import {applyTheme} from 'utils/utils';

// Keep track of the media query listener to avoid adding multiple listeners
let darkModeMediaQuery: MediaQueryList | null = null;
let isListenerInitialized = false;

/**
 * Initializes the system theme detection and switching
 * This should be called once when the application starts
 */
export function initializeSystemThemeDetection(): void {
    // Only initialize once
    if (isListenerInitialized) {
        return;
    }

    // Check if the browser supports prefers-color-scheme
    if (window.matchMedia) {
        darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // Apply the appropriate theme based on the current system preference
        applySystemThemeIfNeeded();

        // Add listener for system theme changes
        if (darkModeMediaQuery.addEventListener) {
            darkModeMediaQuery.addEventListener('change', applySystemThemeIfNeeded);
        } else if (darkModeMediaQuery.addListener) {
            // Fallback for older browsers (Safari <14)
            darkModeMediaQuery.addListener(applySystemThemeIfNeeded);
        }

        isListenerInitialized = true;
    }
}

/**
 * Cleans up the system theme detection listener
 * This should be called when the application is unmounted
 */
export function cleanupSystemThemeDetection(): void {
    if (darkModeMediaQuery && isListenerInitialized) {
        if (darkModeMediaQuery.removeEventListener) {
            darkModeMediaQuery.removeEventListener('change', applySystemThemeIfNeeded);
        } else if (darkModeMediaQuery.removeListener) {
            darkModeMediaQuery.removeListener(applySystemThemeIfNeeded);
        }

        isListenerInitialized = false;
    }
}

/**
 * Checks if theme auto-switch is enabled and applies the appropriate theme
 * based on the system preference
 * @returns {boolean} True if a theme was applied, false otherwise
 */
export function applySystemThemeIfNeeded(): boolean {
    const state = store.getState();

    // Get preferences
    const displayPreferences = state.entities.preferences.myPreferences;
    const themeAutoSwitchPrefKey = `${Preferences.CATEGORY_DISPLAY_SETTINGS}--theme_auto_switch`;
    const themeAutoSwitchPref = displayPreferences[themeAutoSwitchPrefKey];

    // Only proceed if auto-switch is enabled
    if (!themeAutoSwitchPref || themeAutoSwitchPref.value !== 'true') {
        return false;
    }

    // Check system preference
    const isDarkMode = isSystemInDarkMode();

    // Get the appropriate theme
    let theme: Theme;
    if (isDarkMode) {
        // Get dark theme
        const teamId = state.entities.teams.currentTeamId;

        // Try to get team-specific dark theme first, then fall back to default dark theme
        const darkThemePrefKey = `theme_dark--${teamId}`;
        const defaultDarkThemePrefKey = 'theme_dark--';

        if (displayPreferences[darkThemePrefKey]) {
            try {
                theme = JSON.parse(displayPreferences[darkThemePrefKey].value);
            } catch {
                theme = getTheme(state);
            }
        } else if (displayPreferences[defaultDarkThemePrefKey]) {
            try {
                theme = JSON.parse(displayPreferences[defaultDarkThemePrefKey].value);
            } catch {
                theme = getTheme(state);
            }
        } else {
            // If no dark theme is set, use the regular theme
            theme = getTheme(state);
        }
    } else {
        // Use regular theme for light mode
        theme = getTheme(state);
    }

    // Apply the theme
    if (theme) {
        applyTheme(theme);
    }

    return true;
}

/**
 * Returns whether the system is currently in dark mode
 */
export function isSystemInDarkMode(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/**
 * Returns whether a theme is light based on center-channel background luminance.
 * Matches the Desktop App's isLightColor heuristic so auto-switch can keep
 * light and dark slots from driving nativeTheme.themeSource the wrong way.
 */
export function isLightTheme(theme?: Theme | null): boolean {
    const hex = theme?.centerChannelBg?.replace('#', '');
    if (!hex) {
        return true;
    }

    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (full.length < 6) {
        return true;
    }

    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
        return true;
    }

    return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128;
}
