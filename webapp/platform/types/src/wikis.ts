// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IDMappedObjects} from './utilities';

/**
 * Page is the dedicated wire type for wiki pages returned by the server.
 * Replaces the old Page = Post alias; pages are no longer Post-shaped.
 */
export type Page = {
    id: string;
    wiki_id: string;
    parent_id: string;
    type: 'page' | 'page_folder';
    title: string;
    body: string;
    search_text: string;
    user_id: string;
    last_modified_by: string;
    sort_order: number;
    create_at: number;
    update_at: number;
    edit_at: number;
    delete_at: number;
    original_id: string;
    has_effective_view_restriction: boolean;
    has_local_edit_restriction: boolean;
    properties: Record<string, unknown>;
    pending_file_ids: string[];

    /**
     * Client-only field: soft-delete tombstone marker set by the frontend
     * reducer. Not present in server responses.
     */
    state?: 'DELETED';
};

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

export type ChannelMemberLink = {
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
    linksByChannel: Record<string, ChannelMemberLink[]>;
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
