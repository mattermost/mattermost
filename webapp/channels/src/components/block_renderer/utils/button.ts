// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmButtonStyle} from '@mattermost/types/mm_blocks';

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
