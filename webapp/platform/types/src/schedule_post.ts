// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Draft} from './drafts';
import type {Post} from './posts';

export type ScheduledPostErrorCode = 'unknown' | 'channel_archived' | 'channel_not_found' | 'user_missing' | 'user_deleted' | 'no_channel_permission' | 'no_channel_member' | 'thread_deleted' | 'unable_to_send' | 'invalid_post';

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
        [scheduledPostId: string]: ScheduledPost | undefined;
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

export function scheduledPostFromPost(post: Post, schedulingInfo: SchedulingInfo): ScheduledPost {
    return {
        id: '',
        scheduled_at: schedulingInfo.scheduled_at,
        create_at: 0,
        update_at: post.update_at,
        user_id: post.user_id,
        channel_id: post.channel_id,
        root_id: post.root_id,
        message: post.message,
        props: post.props,
        metadata: post.metadata,
        priority: post.metadata.priority,
    };
}

export function scheduledPostToPost(scheduledPost: ScheduledPost): Post {
    const post: Post = {
        edit_at: 0,
        hashtags: '',
        is_pinned: false,
        original_id: '',
        pending_post_id: '',
        reply_count: 0,
        type: '',
        id: scheduledPost.id,
        create_at: scheduledPost.create_at,
        update_at: scheduledPost.update_at,
        delete_at: 0,
        user_id: scheduledPost.user_id,
        channel_id: scheduledPost.channel_id,
        root_id: scheduledPost.root_id,
        message: scheduledPost.message,
        props: scheduledPost.props,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
    };

    if (scheduledPost.metadata) {
        post.metadata = scheduledPost.metadata;
    }

    return post;
}
