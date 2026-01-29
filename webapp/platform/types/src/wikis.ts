// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from './channels';
import type {IDMappedObjects} from './utilities';

export type Wiki = {
    id: string;
    channel_id: string;
    title: string;
    description: string;
    icon: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    sort_order: number;
};

export type WikiCreate = {
    channel_id: string;
    title: string;
    description?: string;
    icon?: string;
};

export type WikiPatch = {
    title?: string;
    description?: string;
    icon?: string;
};

export type WikisState = {
    byChannelId: {[channelId: Channel['id']]: IDMappedObjects<Wiki>};
};

export type BreadcrumbItem = {
    id: string;
    title: string;
    type: 'wiki' | 'page';
    path: string;
    channel_id: string;
};

export type BreadcrumbPath = {
    items: BreadcrumbItem[];
    current_page: BreadcrumbItem;
};
