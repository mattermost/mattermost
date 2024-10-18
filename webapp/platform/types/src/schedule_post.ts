// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostDraft} from 'mattermost-webapp/src/types/store/draft';

import type {Draft} from './drafts';

export type ScheduledPostErrorCode = 'unknown' | 'channel_archived' | 'channel_not_found' | 'user_missing' | 'user_deleted' | 'no_channel_permission' | 'no_channel_member' | 'thread_deleted' | 'unable_to_send';

export type SchedulingInfo = {
    scheduled_at: number;
    processed_at?: number;
    error_code?: ScheduledPostErrorCode;
}

export type ScheduledPost = Omit<Draft, 'delete_at'> & SchedulingInfo & {
    id: string;
}

export type ScheduledPostsState = {
    byId: {
        [scheduledPostId: string]: ScheduledPost;
    };
    byTeamId: {
        [teamId: string]: string[];
    };
    errorsByTeamId: {
        [teamId: string]: string[];
    };
    byChannelOrThreadId: {
        [channelId: string]: string[];
    };
}

export function scheduledPostToPostDraft(scheduledPost: ScheduledPost): PostDraft {
    return {
        message: scheduledPost.message,
        fileInfos: scheduledPost.metadata?.files || [],
        uploadsInProgress: [],
        props: scheduledPost.props,
        channelId: scheduledPost.channel_id,
        rootId: scheduledPost.root_id,
        createAt: 0,
        updateAt: 0,
        metadata: {
            priority: scheduledPost.priority,
        },
    };
}
