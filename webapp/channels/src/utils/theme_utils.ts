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
        try {
            // Modern browsers
            darkModeMediaQuery.addEventListener('change', applySystemThemeIfNeeded);
        } catch (e) {
            // Ignore errors and avoid theme light/dark mode switching in older browsers.
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
        try {
            // Modern browsers
            darkModeMediaQuery.removeEventListener('change', applySystemThemeIfNeeded);
        } catch (e) {
            // Fallback for older browsers that support the deprecated removeListener method
            try {
                if (typeof darkModeMediaQuery.removeListener === 'function') {
                    darkModeMediaQuery.removeListener(applySystemThemeIfNeeded);
                }
            } catch (fallbackError) {
                // Ignore errors and avoid theme light/dark mode switching in older browsers.
            }
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
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Get the appropriate theme
    let theme: Theme;
    if (isDarkMode) {
        // Get dark theme
        const teamId = state.entities.teams.currentTeamId;

        // Try to get team-specific dark theme first, then fall back to default dark theme
        const darkThemePrefKey = `theme_dark--${teamId}`;
        const defaultDarkThemePrefKey = 'theme_dark--';

        if (displayPreferences[darkThemePrefKey]) {
            theme = JSON.parse(displayPreferences[darkThemePrefKey].value);
        } else if (displayPreferences[defaultDarkThemePrefKey]) {
            theme = JSON.parse(displayPreferences[defaultDarkThemePrefKey].value);
        } else {
            // If no dark theme is set, use the regular theme
            theme = getTheme(state);
        }
    } else {
        // Use regular theme for light mode
        theme = getTheme(state);
    }

    // Apply the theme
    applyTheme(theme);

    return true;
}

/**
 * Returns whether the system is currently in dark mode
 */
export function isSystemInDarkMode(): boolean {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
