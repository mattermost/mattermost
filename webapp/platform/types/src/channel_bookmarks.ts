// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from "./channels";
import {FileInfo} from "./files";
import {IDMappedObjects} from "./utilities";

type ChannelBookmarkType = 'link' | 'file';

export type ChannelBookmark = {
    id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    channel_id: string;
    owner_id: string;
    file_id: string;
    display_name: string;
    sort_order: number;
    link_url?: string;
    image_url?: string;
    emoji?: string;
    type: ChannelBookmarkType;
    original_id?: string;
    parent_id?: string;
}

export type ChannelBookmarkPatch = {
    file_id?: string;
    display_name?: string;
    sort_order?: number;
    link_url?: string;
    image_url?: string;
    emoji?: string;
    type?: ChannelBookmarkType;
}

export type ChannelBookmarkWithFileInfo = ChannelBookmark & {
    fileInfo: FileInfo;
}

export type ChannelBookmarksState = {
    byChannelId: {[channelId: Channel['id']]: IDMappedObjects<ChannelBookmark>};
}
