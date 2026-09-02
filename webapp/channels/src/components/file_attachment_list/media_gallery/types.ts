// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

export type TileKind = 'image' | 'video';

export type ClassifiedFile = {
    file: FileInfo;
    kind: TileKind;
};
