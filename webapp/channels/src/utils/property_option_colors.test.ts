// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BOARDS_COLOR_TOKEN_NAMES} from '@mattermost/types/properties_board';

import {COLOR_DESCRIPTOR} from 'utils/board_property_colors';

import {resolveOptionChipColors} from './property_option_colors';

const NEUTRAL = {
    backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
    color: 'rgba(var(--center-channel-color-rgb), 1)',
};

// WCAG 2.1 relative luminance, from https://www.w3.org/TR/WCAG21/#dfn-relative-luminance.
// Deliberately a second implementation rather than a call into theme_utils: the
// point of the test is to check the *result* of getContrastingSimpleColor, so
// reusing its own maths would make the assertion circular.
function relativeLuminance(hex: string): number {
    const value = hex.startsWith('#') ? hex.slice(1) : hex;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.substring(i, i + 2), 16) / 255);
    const [lr, lg, lb] = [r, g, b].map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));

    return (0.2126 * lr) + (0.7152 * lg) + (0.0722 * lb);
}

function contrastRatio(foreground: string, background: string): number {
    const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);

    return (lighter + 0.05) / (darker + 0.05);
}

describe('resolveOptionChipColors', () => {
    describe('boards palette tokens', () => {
        it.each(BOARDS_COLOR_TOKEN_NAMES)('uses the %s token background from COLOR_DESCRIPTOR', (token) => {
            expect(resolveOptionChipColors(token).backgroundColor).toBe(COLOR_DESCRIPTOR[token].color);
        });

        // The whole reason the foreground is derived rather than hand-authored:
        // nine backgrounds and nine foregrounds drift, a derivation cannot.
        // Both are opaque hex, so this holds in every theme.
        it.each(BOARDS_COLOR_TOKEN_NAMES)('clears WCAG AA 4.5:1 for the %s token', (token) => {
            const {backgroundColor, color} = resolveOptionChipColors(token);

            expect(contrastRatio(color, backgroundColor)).toBeGreaterThanOrEqual(4.5);
        });

        it('derives black or white, never a theme variable', () => {
            for (const token of BOARDS_COLOR_TOKEN_NAMES) {
                expect(resolveOptionChipColors(token).color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            }
        });
    });

    // Content flagging seeds these four names in a migration. They are semantic
    // theme colours rather than palette tokens, and this slice must not move
    // them by a byte.
    describe('content flagging colours', () => {
        it.each([
            ['light_blue', {backgroundColor: 'var(--sidebar-text-active-border)', color: '#FFF'}],
            ['dark_blue', {backgroundColor: 'rgba(var(--sidebar-text-active-border-rgb), 0.92)', color: '#FFF'}],
            ['dark_red', {backgroundColor: 'var(--error-text)', color: '#FFF'}],
            ['light_grey', NEUTRAL],
        ])('keeps %s exactly as it renders today', (name, expected) => {
            expect(resolveOptionChipColors(name as string)).toEqual(expected);
        });

        // `light_gray` and `light_grey` reached identical output by accident —
        // one through an explicit case, the other through the default branch.
        // Both are named entries now, so they cannot drift apart.
        it('treats the light_gray spelling as light_grey', () => {
            expect(resolveOptionChipColors('light_gray')).toEqual(resolveOptionChipColors('light_grey'));
        });
    });

    describe('fallbacks', () => {
        it('returns the theme-aware neutral when no colour is set', () => {
            expect(resolveOptionChipColors()).toEqual(NEUTRAL);
            expect(resolveOptionChipColors('')).toEqual(NEUTRAL);
        });

        // Nothing on the server constrains `option.color` for all groups so one
        // feature's palette can reach another feature's renderer. The chip still
        // renders and stays legible, so it falls back and says nothing, matching
        // `normalizeColor` in utils/board_property_colors.
        it('falls to neutral for an unrecognised token', () => {
            expect(resolveOptionChipColors('chartreuse')).toEqual(NEUTRAL);
        });
    });
});
