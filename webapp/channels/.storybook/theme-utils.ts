// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Theme utilities for Storybook
 * 
 * This file provides theme definitions and utilities to apply Mattermost themes in Storybook.
 * It mirrors the theme application logic from webapp/channels/src/utils/utils.tsx
 */

import type {Theme} from '../src/packages/mattermost-redux/src/selectors/entities/preferences';

// Import the official Mattermost themes
import Preferences from '../src/packages/mattermost-redux/src/constants/preferences';

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
 * Convert hex color to RGB values string (e.g., "255, 255, 255")
 */
function toRgbValues(hexStr: string): string {
    if (!hexStr || hexStr[0] !== '#') {
        return '0, 0, 0';
    }

    const hex = hexStr.substring(1);
    let r = 0;
    let g = 0;
    let b = 0;

    if (hex.length === 3) {
        r = parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16);
        g = parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16);
        b = parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }

    return `${r}, ${g}, ${b}`;
}

/**
 * Blend two colors together
 * Used for creating derived theme colors
 */
function blendColors(color1: string, color2: string, ratio: number, asHex = false): string {
    const hex = (x: string) => {
        const hexValue = x.toString(16);
        return hexValue.length === 1 ? '0' + hexValue : hexValue;
    };

    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);

    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);

    const r = Math.ceil(r1 * ratio + r2 * (1 - ratio));
    const g = Math.ceil(g1 * ratio + g2 * (1 - ratio));
    const b = Math.ceil(b1 * ratio + b2 * (1 - ratio));

    if (asHex) {
        return '#' + hex(r) + hex(g) + hex(b);
    }

    return `${r}, ${g}, ${b}`;
}

/**
 * Drop alpha channel from rgba string, returning rgb string
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
        {value: THEME_KEYS.DENIM, title: 'Denim (Light)', left: '🔵'},
        {value: THEME_KEYS.SAPPHIRE, title: 'Sapphire (Light)', left: '💎'},
        {value: THEME_KEYS.QUARTZ, title: 'Quartz (Light)', left: '⚪'},
        {value: THEME_KEYS.INDIGO, title: 'Indigo (Dark)', left: '🌙'},
        {value: THEME_KEYS.ONYX, title: 'Onyx (Dark)', left: '⚫'},
    ];
}

