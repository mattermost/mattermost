// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

export type LinkInfo = {
    has_preview_image: boolean;
    link: string;
    extension: string;
    name: string;
}

export function isFileInfo(info: FileInfo | LinkInfo): info is FileInfo {
    return Boolean((info as FileInfo).id);
}

export function isLinkInfo(info: FileInfo | LinkInfo): info is LinkInfo {
    return Boolean((info as LinkInfo).link) && !isFileInfo(info);
}
