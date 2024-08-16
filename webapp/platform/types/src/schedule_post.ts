// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostMetadata, PostPriorityMetadata} from './posts';

export type SchedulePost = {
    id: string;
    create_at: number;
    update_at: number;
    user_id: string;
    channel_id: string;
    root_id: string;
    message: string;
    props: Record<string, any>;
    file_ids?: string[];
    priority?: PostPriorityMetadata;
    metadata?: PostMetadata;
    scheduled_at: string;
    processed_at?: string;
    error_code?: string;
}
