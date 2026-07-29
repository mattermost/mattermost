// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

import type {ClassifiedFile} from './types';

export type PackOptions = {
    containerWidth: number;
    rowHeight: number;
    minTileWidth: number;
    maxTileWidth: number;
    gap: number;
};

export type PackedTile = {
    tile: ClassifiedFile;
    width: number;
    height: number;
};

export type PackedRow = {
    tiles: PackedTile[];
    height: number;
};

const DEFAULT_ASPECT_RATIO = 1.5;

function ratioOf(file: FileInfo): number {
    if (file.width && file.height && file.width > 0 && file.height > 0) {
        return file.width / file.height;
    }
    return DEFAULT_ASPECT_RATIO;
}

function tileSize(tile: ClassifiedFile, opts: PackOptions): {width: number; height: number} {
    const ratio = ratioOf(tile.file);
    let width = ratio * opts.rowHeight;
    let height = opts.rowHeight;

    if (tile.file.width && tile.file.height) {
        if (width > tile.file.width) {
            width = tile.file.width;
            height = tile.file.height;
        }
    }

    const upperBound = Math.min(opts.maxTileWidth, opts.containerWidth);
    if (width > upperBound) {
        height *= upperBound / width;
        width = upperBound;
    }
    if (width < opts.minTileWidth) {
        height *= opts.minTileWidth / width;
        width = opts.minTileWidth;
    }

    return {width, height};
}

export function packRows(tiles: ClassifiedFile[], opts: PackOptions): PackedRow[] {
    const rows: PackedRow[] = [];
    if (tiles.length === 0 || opts.containerWidth <= 0 || opts.rowHeight <= 0) {
        return rows;
    }

    let current: PackedTile[] = [];
    let currentWidth = 0;

    for (const tile of tiles) {
        const {width, height} = tileSize(tile, opts);
        const addedWidth = current.length === 0 ? width : currentWidth + opts.gap + width;

        if (current.length > 0 && addedWidth > opts.containerWidth) {
            rows.push({tiles: current, height: opts.rowHeight});
            current = [{tile, width, height}];
            currentWidth = width;
            continue;
        }

        current.push({tile, width, height});
        currentWidth = addedWidth;
    }

    if (current.length > 0) {
        rows.push({tiles: current, height: opts.rowHeight});
    }

    return rows;
}
