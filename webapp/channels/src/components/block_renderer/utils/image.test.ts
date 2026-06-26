// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmImageBlock} from '@mattermost/types/mm_blocks';

import {MM_IMAGE_ALIGN_JUSTIFY, MM_IMAGE_SIZE_CAPS, resolveMmImageCaps} from './image';

describe('resolveMmImageCaps', () => {
    it('returns empty caps for auto size without explicit dimensions', () => {
        expect(resolveMmImageCaps({type: 'image', url: 'https://example.com/x.png', size: 'auto'})).toEqual({});
    });

    it('uses stretch preset when size is omitted', () => {
        expect(resolveMmImageCaps({type: 'image', url: 'https://example.com/x.png'})).toEqual({
            maxWidth: MM_IMAGE_SIZE_CAPS.stretch!.maxWidth,
            maxHeight: MM_IMAGE_SIZE_CAPS.stretch!.maxHeight,
        });
    });

    it('uses named size presets', () => {
        expect(resolveMmImageCaps({type: 'image', url: 'https://example.com/x.png', size: 'small'})).toEqual({
            maxWidth: MM_IMAGE_SIZE_CAPS.small!.maxWidth,
            maxHeight: MM_IMAGE_SIZE_CAPS.small!.maxHeight,
        });
    });

    it('prefers explicit max_width and max_height over presets', () => {
        const block: MmImageBlock = {
            type: 'image',
            url: 'https://example.com/x.png',
            size: 'small',
            max_width: 400,
            max_height: 300,
        };
        expect(resolveMmImageCaps(block)).toEqual({maxWidth: 400, maxHeight: 300});
    });

    it('allows partial override of preset dimensions', () => {
        expect(resolveMmImageCaps({
            type: 'image',
            url: 'https://example.com/x.png',
            size: 'medium',
            max_width: 200,
        })).toEqual({maxWidth: 200, maxHeight: 184});
    });
});

describe('MM_IMAGE_ALIGN_JUSTIFY', () => {
    it('maps alignment to flex justifyContent values', () => {
        expect(MM_IMAGE_ALIGN_JUSTIFY.left).toBe('flex-start');
        expect(MM_IMAGE_ALIGN_JUSTIFY.center).toBe('center');
        expect(MM_IMAGE_ALIGN_JUSTIFY.right).toBe('flex-end');
    });
});
