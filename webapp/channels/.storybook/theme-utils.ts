// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Theme utilities for Storybook
 * 
 * This file provides utilities to apply Mattermost themes in Storybook.
 * It reuses existing theme utilities from the webapp.
 */

import type {Theme} from '../src/packages/mattermost-redux/src/selectors/entities/preferences';

// Import the official Mattermost themes
import Preferences from '../src/packages/mattermost-redux/src/constants/preferences';

// Reuse existing utilities from the webapp
import {toRgbValues} from '../src/utils/utils';
import {blendColors} from '../src/packages/mattermost-redux/src/utils/theme_utils';

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
 * Drop alpha channel from rgba string, returning rgb string
 * Helper function for derived color calculations
 */
function dropAlpha(rgba: string): string {
    if (rgba.includes(',')) {
        const parts = rgba.split(',');
        if (parts.length >= 3) {
            return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
        }
    }
    return rgba;
}

/**
 * Apply a Mattermost theme by setting CSS variables
 * This mimics the behavior of applyTheme() in utils.tsx
 */
export function applyThemeToStorybook(theme: Theme): void {
    const root = document.documentElement;

    // Set hex values
    root.style.setProperty('--away-indicator', theme.awayIndicator);
    root.style.setProperty('--button-bg', theme.buttonBg);
    root.style.setProperty('--button-color', theme.buttonColor);
    root.style.setProperty('--center-channel-bg', theme.centerChannelBg);
    root.style.setProperty('--center-channel-color', theme.centerChannelColor);
    root.style.setProperty('--dnd-indicator', theme.dndIndicator);
    root.style.setProperty('--error-text', theme.errorTextColor);
    root.style.setProperty('--link-color', theme.linkColor);
    root.style.setProperty('--mention-bg', theme.mentionBg);
    root.style.setProperty('--mention-color', theme.mentionColor);
    root.style.setProperty('--mention-highlight-bg', theme.mentionHighlightBg);
    root.style.setProperty('--mention-highlight-link', theme.mentionHighlightLink);
    root.style.setProperty('--new-message-separator', theme.newMessageSeparator);
    root.style.setProperty('--online-indicator', theme.onlineIndicator);
    root.style.setProperty('--sidebar-bg', theme.sidebarBg);
    root.style.setProperty('--sidebar-header-bg', theme.sidebarHeaderBg);
    root.style.setProperty('--sidebar-header-text-color', theme.sidebarHeaderTextColor);
    root.style.setProperty('--sidebar-text', theme.sidebarText);
    root.style.setProperty('--sidebar-text-active-border', theme.sidebarTextActiveBorder);
    root.style.setProperty('--sidebar-text-active-color', theme.sidebarTextActiveColor);
    root.style.setProperty('--sidebar-text-hover-bg', theme.sidebarTextHoverBg);
    root.style.setProperty('--sidebar-unread-text', theme.sidebarUnreadText);
    root.style.setProperty('--sidebar-team-background', theme.sidebarTeamBarBg);

    // Set RGB values (used for opacity calculations)
    root.style.setProperty('--away-indicator-rgb', toRgbValues(theme.awayIndicator));
    root.style.setProperty('--button-bg-rgb', toRgbValues(theme.buttonBg));
    root.style.setProperty('--button-color-rgb', toRgbValues(theme.buttonColor));
    root.style.setProperty('--center-channel-bg-rgb', toRgbValues(theme.centerChannelBg));
    root.style.setProperty('--center-channel-color-rgb', toRgbValues(theme.centerChannelColor));
    root.style.setProperty('--dnd-indicator-rgb', toRgbValues(theme.dndIndicator));
    root.style.setProperty('--error-text-color-rgb', toRgbValues(theme.errorTextColor));
    root.style.setProperty('--link-color-rgb', toRgbValues(theme.linkColor));
    root.style.setProperty('--mention-bg-rgb', toRgbValues(theme.mentionBg));
    root.style.setProperty('--mention-color-rgb', toRgbValues(theme.mentionColor));
    root.style.setProperty('--mention-highlight-bg-rgb', toRgbValues(theme.mentionHighlightBg));
    root.style.setProperty('--mention-highlight-link-rgb', toRgbValues(theme.mentionHighlightLink));
    root.style.setProperty('--new-message-separator-rgb', toRgbValues(theme.newMessageSeparator));
    root.style.setProperty('--online-indicator-rgb', toRgbValues(theme.onlineIndicator));
    root.style.setProperty('--sidebar-bg-rgb', toRgbValues(theme.sidebarBg));
    root.style.setProperty('--sidebar-header-bg-rgb', toRgbValues(theme.sidebarHeaderBg));
    root.style.setProperty('--sidebar-header-text-color-rgb', toRgbValues(theme.sidebarHeaderTextColor));
    root.style.setProperty('--sidebar-text-rgb', toRgbValues(theme.sidebarText));
    root.style.setProperty('--sidebar-text-active-border-rgb', toRgbValues(theme.sidebarTextActiveBorder));

    // Set derived/blended colors
    root.style.setProperty(
        '--mention-highlight-bg-mixed-rgb',
        dropAlpha(blendColors(theme.centerChannelBg, theme.mentionHighlightBg, 0.5))
    );
    root.style.setProperty(
        '--pinned-highlight-bg-mixed-rgb',
        dropAlpha(blendColors(theme.centerChannelBg, theme.mentionHighlightBg, 0.24))
    );
    root.style.setProperty(
        '--own-highlight-bg-rgb',
        dropAlpha(blendColors(theme.mentionHighlightBg, theme.centerChannelColor, 0.05))
    );

    // Update body background color to match theme
    document.body.style.backgroundColor = theme.centerChannelBg;
    document.body.style.color = theme.centerChannelColor;
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

