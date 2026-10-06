// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

export type TileSizeOptions = {
    rowHeight: number;
    minTileWidth: number;
    maxTileWidth: number;
};

const DEFAULT_ASPECT_RATIO = 1.5;

function ratioOf(file: FileInfo): number {
    if (file.width && file.height && file.width > 0 && file.height > 0) {
        return file.width / file.height;
    }
    return DEFAULT_ASPECT_RATIO;
}

// Tiles wrap into rows via CSS flex-wrap rather than JS packing, so the post
// has its final height on first render instead of after measuring the container.
export function tileWidth(file: FileInfo, opts: TileSizeOptions): number {
    let width = ratioOf(file) * opts.rowHeight;

    if (file.width && width > file.width) {
        width = file.width;
    }

    return Math.max(opts.minTileWidth, Math.min(width, opts.maxTileWidth));
}
