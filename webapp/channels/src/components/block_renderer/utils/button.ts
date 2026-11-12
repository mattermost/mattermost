// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CSSProperties} from 'react';

import type {MmButtonStyle} from '@mattermost/types/mm_blocks';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {secureGetFromRecord} from 'mattermost-redux/utils/post_utils';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

const MM_BUTTON_SEMANTIC_STYLES = new Set<MmButtonStyle>([
    'default',
    'primary',
    'danger',
    'good',
    'success',
    'warning',
]);

const MM_BUTTON_HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

/**
 * Preserves semantic styles and hex colors from legacy attachment actions / integration payloads.
 * Returns `undefined` for omitted or invalid values.
 */
export function parseMmButtonStyle(style: string | undefined): string | undefined {
    if (!style) {
        return undefined;
    }
    if (MM_BUTTON_SEMANTIC_STYLES.has(style as MmButtonStyle)) {
        return style;
    }
    if (MM_BUTTON_HEX_COLOR.test(style)) {
        return style;
    }
    return undefined;
}

export function isMmButtonSemanticStyle(style: string | undefined): style is MmButtonStyle {
    return Boolean(style && MM_BUTTON_SEMANTIC_STYLES.has(style as MmButtonStyle));
}

export function isMmButtonHexColor(style: string | undefined): boolean {
    return Boolean(style && MM_BUTTON_HEX_COLOR.test(style));
}

/** Base class plus extras for semantic colors Compass Button does not express (good/success/warning). */
export function mmBlocksButtonClassName(style: string | undefined): string {
    switch (style) {
    case 'good':
        return 'mm-blocks-button mm-blocks-button--good';
    case 'success':
        return 'mm-blocks-button mm-blocks-button--success';
    case 'warning':
        return 'mm-blocks-button mm-blocks-button--warning';
    default:
        return 'mm-blocks-button';
    }
}

function resolveMmButtonThemeColor(style: string, theme: Theme): string | undefined {
    const fromTheme = secureGetFromRecord(theme, style);
    if (typeof fromTheme === 'string') {
        return fromTheme;
    }
    return undefined;
}

export type MmBlocksButtonCSSProperties = CSSProperties & {
    '--button-fg'?: string;
};

/** Inline colors for hex values and theme keys (e.g. `onlineIndicator`), matching legacy `ActionButton`. */
export function mmBlocksButtonInlineStyle(style: string | undefined, theme: Theme): MmBlocksButtonCSSProperties | undefined {
    if (!style || isMmButtonSemanticStyle(style)) {
        return undefined;
    }
    if (isMmButtonHexColor(style)) {
        return mmBlocksButtonColorStyle(style);
    }
    const themeColor = resolveMmButtonThemeColor(style, theme);
    if (!themeColor) {
        return undefined;
    }
    return mmBlocksButtonColorStyle(themeColor);
}

function mmBlocksButtonColorStyle(color: string): MmBlocksButtonCSSProperties {
    // Compass Button paints label/icon via `--button-fg`, not inherited `color`.
    return {
        backgroundColor: changeOpacity(color, 0.08),
        color,
        '--button-fg': color,
    };
}
