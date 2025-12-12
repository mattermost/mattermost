// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostMetadata, PostPriorityMetadata, PostType} from './posts';

export type Draft = {
    create_at: number;
    update_at: number;
    delete_at: number;
    user_id: string;
    channel_id: string;
    wiki_id?: string;
    root_id: string;
    message: string;
    type?: PostType;
    props: Record<string, any>;
    file_ids?: string[];
    metadata?: PostMetadata;
    priority?: PostPriorityMetadata;
};

export type PageDraft = {
    user_id: string;
    wiki_id: string;
    page_id: string;
    title: string;
    content: any;
    file_ids?: string[];
    props: Record<string, any>;
    create_at: number;
    update_at: number;
    has_published_version: boolean;
};

export type PageDraftLocal = {
    pageId: string;
    message: string;
    updatedAt: number;
    saving: boolean;
};
