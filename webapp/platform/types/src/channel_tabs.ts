// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from './channels';
import type {FileInfo} from './files';
import type {IDMappedObjects} from './utilities';

type ChannelTabType = 'link' | 'file';

export type ChannelTab = {
    id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    channel_id: string;
    owner_id: string;
    file_id?: string;
    file?: FileInfo;
    display_name: string;
    sort_order: number;
    link_url?: string;
    image_url?: string;
    emoji?: string;
    type: ChannelTabType;
    original_id?: string;
    parent_id?: string;
}

export type ChannelTabCreate = {
    display_name: string;
    image_url?: string;
    emoji?: string;
    type: ChannelTabType;
} & ({
    type: 'link';
    link_url: string;
} | {
    type: 'file';
    file_id: string;
})

export type ChannelTabPatch = {
    file_id?: string;
    display_name?: string;
    sort_order?: number;
    link_url?: string;
    image_url?: string;
    emoji?: string;
}

export type UpdateChannelTabResponse = {
    updated?: ChannelTabWithFileInfo;
    deleted?: ChannelTabWithFileInfo;
};

export type ChannelTabWithFileInfo = ChannelTab & {
    file: FileInfo;
}

export type ChannelTabsState = {
    byChannelId: {[channelId: Channel['id']]: IDMappedObjects<ChannelTab>};
}
