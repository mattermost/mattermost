// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CSSProperties} from 'react';

import type {MmImageBlock, MmImageSize} from '@mattermost/types/mm_blocks';

/** Preset caps loosely aligned with Adaptive Cards `Image` sizes; `stretch` matches legacy attachment `image_url`. */
export const MM_IMAGE_SIZE_CAPS: Record<MmImageSize, {maxWidth: number; maxHeight: number} | null> = {
    auto: null,
    xsmall: {maxWidth: 108, maxHeight: 64},
    small: {maxWidth: 204, maxHeight: 120},
    medium: {maxWidth: 320, maxHeight: 184},
    large: {maxWidth: 428, maxHeight: 240},
    stretch: {maxWidth: 500, maxHeight: 350},
};

export function resolveMmImageCaps(block: MmImageBlock): {maxWidth?: number; maxHeight?: number} {
    const size = block.size ?? 'stretch';
    const preset = MM_IMAGE_SIZE_CAPS[size];
    const maxWidth = block.max_width ?? preset?.maxWidth;
    const maxHeight = block.max_height ?? preset?.maxHeight;
    if (size === 'auto' && block.max_width === undefined && block.max_height === undefined) {
        return {};
    }
    const out: {maxWidth?: number; maxHeight?: number} = {};
    if (maxWidth !== undefined) {
        out.maxWidth = maxWidth;
    }
    if (maxHeight !== undefined) {
        out.maxHeight = maxHeight;
    }
    return out;
}

export const MM_IMAGE_ALIGN_JUSTIFY: Record<'left' | 'center' | 'right', NonNullable<CSSProperties['justifyContent']>> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
};
