// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BOARDS_COLOR_TOKEN_NAMES} from '@mattermost/types/properties_board';

import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import {COLOR_DESCRIPTOR} from 'utils/board_property_colors';

export type OptionChipColors = {
    backgroundColor: string;
    color: string;
};

/**
 * What an option with no colour, or with a colour nothing recognises, has always
 * rendered as. Theme-aware on purpose: it is the only entry here that has to stay
 * legible against both a light and a dark canvas.
 */
const NEUTRAL: OptionChipColors = {
    backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
    color: 'rgba(var(--center-channel-color-rgb), 1)',
};

/**
 * The four names content flagging seeds. These are semantic theme colours rather
 * than palette tokens, so they keep the foregrounds they were hand-picked with.
 *
 * `light_gray` is listed beside `light_grey` for the reader rather than for the
 * lookup: both spellings are in the wild, both already produced identical output —
 * one through an explicit case and one through the default branch — and naming the
 * pair says that is deliberate rather than a coincidence nobody has noticed.
 */
const SEMANTIC_COLORS = new Map<string, OptionChipColors>([
    ['light_blue', {backgroundColor: 'var(--sidebar-text-active-border)', color: '#FFF'}],
    ['dark_blue', {backgroundColor: 'rgba(var(--sidebar-text-active-border-rgb), 0.92)', color: '#FFF'}],
    ['dark_red', {backgroundColor: 'var(--error-text)', color: '#FFF'}],
    ['light_grey', NEUTRAL],
    ['light_gray', NEUTRAL],
]);

/**
 * The boards palette, with each foreground *derived* from its background rather
 * than hand-authored. Nine backgrounds and nine foregrounds drift apart the first
 * time someone tweaks a pastel; a derivation cannot. Both are opaque hex, so the
 * pair holds its contrast in every theme.
 */
const BOARDS_COLORS = new Map<string, OptionChipColors>(
    BOARDS_COLOR_TOKEN_NAMES.map((token) => {
        const backgroundColor = COLOR_DESCRIPTOR[token].color;

        return [token, {backgroundColor, color: getContrastingSimpleColor(backgroundColor)}];
    }),
);

/**
 * The background and foreground for one option chip.
 *
 * An unrecognised token and an absent one both take the neutral pair, silently.
 */
export function resolveOptionChipColors(colorName?: string): OptionChipColors {
    if (!colorName) {
        return NEUTRAL;
    }

    return SEMANTIC_COLORS.get(colorName) ?? BOARDS_COLORS.get(colorName) ?? NEUTRAL;
}
