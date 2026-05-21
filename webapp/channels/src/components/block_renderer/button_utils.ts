// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CSSProperties} from 'react';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {secureGetFromRecord} from 'mattermost-redux/utils/post_utils';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import {isMmButtonHexColor, isMmButtonSemanticStyle} from './utils/button';

export function mmBlocksButtonClassName(style: string | undefined): string {
    const base = 'btn btn-sm';
    if (!style || style === 'default') {
        return `${base} btn-tertiary`;
    }
    switch (style) {
    case 'primary':
        return `${base} btn-primary`;
    case 'danger':
        return `${base} btn-tertiary btn-danger`;
    case 'good':
        return `${base} btn-tertiary mm-blocks-button--good`;
    case 'success':
        return `${base} btn-tertiary mm-blocks-button--success`;
    case 'warning':
        return `${base} btn-tertiary mm-blocks-button--warning`;
    default:
        return `${base} btn-tertiary`;
    }
}

function resolveMmButtonThemeColor(style: string, theme: Theme): string | undefined {
    const fromTheme = secureGetFromRecord(theme, style);
    if (typeof fromTheme === 'string') {
        return fromTheme;
    }
    return undefined;
}

/** Inline colors for hex values and theme keys (e.g. `onlineIndicator`), matching legacy `ActionButton`. */
export function mmBlocksButtonInlineStyle(style: string | undefined, theme: Theme): CSSProperties | undefined {
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

function mmBlocksButtonColorStyle(color: string): CSSProperties {
    return {
        backgroundColor: changeOpacity(color, 0.08),
        color,
    };
}
