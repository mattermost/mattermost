// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Draft} from './drafts';

export type ScheduledPostErrorCode = 'unknown' | 'channel_archived' | 'channel_not_found' | 'user_missing' | 'user_deleted' | 'no_channel_permission' | 'no_channel_member' | 'thread_deleted';

export type SchedulingInfo = {
    scheduled_at: number;
    processed_at?: number;
    error_code?: ScheduledPostErrorCode;
}

export type ScheduledPost = Omit<Draft, 'delete_at'> & SchedulingInfo & {
    id: string;
}

export type ScheduledPostsState = {
    byTeamId: {
        [teamId: string]: ScheduledPost[];
    };
    errorsByTeamId: {
        [teamId: string]: string[];
    };
    byChannelId: {
        [channelId: string]: string[];
    };
}
