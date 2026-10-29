// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

import {tileWidth} from './tile_size';

function file(width?: number, height?: number): FileInfo {
    return {id: 'f', width, height} as FileInfo;
}

describe('tileWidth', () => {
    const opts = {
        rowHeight: 216,
        minTileWidth: 50,
        maxTileWidth: 500,
    };

    it('scales the tile to the row height using the image aspect ratio', () => {
        expect(tileWidth(file(800, 600), opts)).toBeCloseTo(288);
    });

    it('does not upscale an image narrower than its row-height width', () => {
        expect(tileWidth(file(120, 200), opts)).toBe(120);
    });

    it('floors a sub-min tile at minTileWidth (the image inside still renders at native size via inline caps)', () => {
        expect(tileWidth(file(40, 40), opts)).toBe(opts.minTileWidth);
    });

    it('caps very wide tiles at maxTileWidth', () => {
        expect(tileWidth(file(4000, 1000), opts)).toBe(opts.maxTileWidth);
    });

    it('uses a 1.5 default aspect ratio when a file is missing dimensions', () => {
        expect(tileWidth(file(), opts)).toBeCloseTo(opts.rowHeight * 1.5);
    });
});
