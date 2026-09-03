// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmImageBlock} from '@mattermost/types/mm_blocks';

import {translateAdaptiveCards} from './adaptive_cards';

function imageFromCards(width: unknown, height?: unknown): MmImageBlock | undefined {
    const blocks = translateAdaptiveCards([{
        type: 'AdaptiveCard',
        body: [{
            type: 'Image',
            url: 'https://example.com/x.png',
            width,
            ...(height === undefined ? {} : {height}),
        }],
    }]);
    return blocks.find((b): b is MmImageBlock => b.type === 'image');
}

describe('translateAdaptiveCards Image pixel dimensions', () => {
    it('accepts plain numbers, px suffix, and decimal literals', () => {
        expect(imageFromCards(120)?.max_width).toBe(120);
        expect(imageFromCards('80px')?.max_width).toBe(80);
        expect(imageFromCards('12.5')?.max_width).toBe(13);
    });

    it('rejects percent and partially numeric strings', () => {
        const image = imageFromCards('100%', '10abc');
        expect(image?.max_width).toBeUndefined();
        expect(image?.max_height).toBeUndefined();
    });
});
