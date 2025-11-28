// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Theme utilities for Storybook
 * 
 * This file provides theme configuration for Storybook.
 * It reuses the existing applyTheme function from the webapp.
 */

import type {Theme} from '../src/packages/mattermost-redux/src/selectors/entities/preferences';

// Import the official Mattermost themes
import Preferences from '../src/packages/mattermost-redux/src/constants/preferences';

// Reuse existing theme application function from the webapp
import {applyTheme} from '../src/utils/utils';

export const THEMES = Preferences.THEMES;

export const THEME_KEYS = {
    DENIM: 'denim',
    SAPPHIRE: 'sapphire',
    QUARTZ: 'quartz',
    INDIGO: 'indigo',
    ONYX: 'onyx',
} as const;

export type ThemeKey = typeof THEME_KEYS[keyof typeof THEME_KEYS];

/**
 * Apply a Mattermost theme in Storybook
 * This is just a wrapper around the existing applyTheme function
 */
export function applyThemeToStorybook(theme: Theme): void {
    applyTheme(theme);
}

/**
 * Get theme by key
 */
export function getTheme(themeKey: ThemeKey): Theme {
    return THEMES[themeKey];
}

/**
 * Get all available theme options for Storybook toolbar
 */
export function getThemeOptions() {
    return [
        {value: THEME_KEYS.DENIM, title: 'Denim (Light)'},
        {value: THEME_KEYS.SAPPHIRE, title: 'Sapphire (Light)'},
        {value: THEME_KEYS.QUARTZ, title: 'Quartz (Light)'},
        {value: THEME_KEYS.INDIGO, title: 'Indigo (Dark)'},
        {value: THEME_KEYS.ONYX, title: 'Onyx (Dark)'},
    ];
}

