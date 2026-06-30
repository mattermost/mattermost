// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

import {packRows} from './pack_rows';
import type {ClassifiedFile} from './types';

function tile(width: number, height: number, id = 'f'): ClassifiedFile {
    return {
        file: {id, width, height} as FileInfo,
        kind: 'image',
    };
}

describe('packRows', () => {
    const baseOpts = {
        containerWidth: 700,
        rowHeight: 216,
        minTileWidth: 50,
        maxTileWidth: 500,
        gap: 8,
    };

    it('returns no rows when there are no tiles', () => {
        expect(packRows([], baseOpts)).toEqual([]);
    });

    it('returns no rows when the container has zero width', () => {
        expect(packRows([tile(800, 600)], {...baseOpts, containerWidth: 0})).toEqual([]);
    });

    it('keeps every row at the configured (predictable) row height', () => {
        const tiles = [
            tile(800, 600, 'a'),
            tile(800, 600, 'b'),
            tile(800, 600, 'c'),
            tile(800, 600, 'd'),
            tile(800, 600, 'e'),
        ];
        const rows = packRows(tiles, baseOpts);
        for (const row of rows) {
            expect(row.height).toBe(baseOpts.rowHeight);
        }
    });

    it('leaves the last row ragged on the right rather than scaling tiles to fill', () => {
        const tiles = [
            tile(800, 600, 'a'),
            tile(800, 600, 'b'),
            tile(800, 600, 'c'),
            tile(800, 600, 'd'),
        ];
        const rows = packRows(tiles, baseOpts);

        const last = rows[rows.length - 1];
        const lastWidth = last.tiles.reduce((acc, t) => acc + t.width, 0) +
            ((last.tiles.length - 1) * baseOpts.gap);
        expect(lastWidth).toBeLessThanOrEqual(baseOpts.containerWidth + 0.5);
    });

    it('never packs a row wider than the container', () => {
        const tiles = [
            tile(1600, 600, 'a'),
            tile(1600, 600, 'b'),
            tile(1600, 600, 'c'),
        ];
        const rows = packRows(tiles, baseOpts);
        for (const row of rows) {
            const width = row.tiles.reduce((acc, t) => acc + t.width, 0) +
                ((row.tiles.length - 1) * baseOpts.gap);
            expect(width).toBeLessThanOrEqual(baseOpts.containerWidth + 0.5);
        }
    });

    it('floors a sub-min tile at minTileWidth (the image inside still renders at native size via inline caps)', () => {
        const rows = packRows([tile(40, 40)], baseOpts);
        const packed = rows[0].tiles[0];
        expect(packed.width).toBe(baseOpts.minTileWidth);
    });

    it('caps very wide tiles at maxTileWidth', () => {
        const rows = packRows([tile(4000, 1000)], baseOpts);
        const packed = rows[0].tiles[0];
        expect(packed.width).toBeLessThanOrEqual(baseOpts.maxTileWidth);
    });

    it('uses a 1.5 default aspect ratio when a file is missing dimensions', () => {
        const noDimsTile: ClassifiedFile = {
            file: {id: 'x'} as FileInfo,
            kind: 'image',
        };
        const rows = packRows([noDimsTile], baseOpts);
        expect(rows).toHaveLength(1);
        expect(rows[0].tiles[0].width).toBeCloseTo(baseOpts.rowHeight * 1.5);
    });
});
