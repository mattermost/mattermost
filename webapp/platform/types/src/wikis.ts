// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IDMappedObjects} from './utilities';

export type Wiki = {
    id: string;
    team_id: string;
    creator_id: string;
    title: string;
    description: string;
    icon: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    sort_order: number;
    props?: Record<string, string>;
};

export type WikiLink = {
    source_id: string;
    wiki_id: string;
    create_at: number;
    creator_id?: string;
};

export type WikiCreate = {
    team_id: string;
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
    byId: IDMappedObjects<Wiki>;
    byTeam: Record<string, string[]>;
    linksByChannel: Record<string, WikiLink[]>;
};

export type BreadcrumbItem = {
    id: string;
    title: string;
    type: 'wiki' | 'page';
    path: string;
};

export type BreadcrumbPath = {
    items: BreadcrumbItem[];
    current_page: BreadcrumbItem;
};
