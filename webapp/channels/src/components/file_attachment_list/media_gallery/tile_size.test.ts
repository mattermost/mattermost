// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

import {tileSizeVars} from './tile_size';

function file(width?: number, height?: number): FileInfo {
    return {id: 'f', width, height} as FileInfo;
}

describe('tileSizeVars', () => {
    it('exposes the image aspect ratio and native width', () => {
        expect(tileSizeVars(file(800, 600))).toEqual({
            '--tile-ratio': String(800 / 600),
            '--tile-native-width': '800px',
        });
    });

    it('uses a 1.5 default aspect ratio and no native width when a file is missing dimensions', () => {
        expect(tileSizeVars(file())).toEqual({
            '--tile-ratio': '1.5',
        });
    });
});
