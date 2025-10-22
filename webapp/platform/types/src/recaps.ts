// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Recap = {
    id: string;
    user_id: string;
    title: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    read_at: number;
    total_message_count: number;
    status: RecapStatus;
    channels?: RecapChannel[];
};

export type RecapChannel = {
    id: string;
    recap_id: string;
    channel_id: string;
    channel_name: string;
    highlights: string[];
    action_items: string[];
    source_post_ids: string[];
    create_at: number;
};

export type CreateRecapRequest = {
    title: string;
    channel_ids: string[];
};

export type RecapStatus = 'pending' | 'processing' | 'completed' | 'failed';

