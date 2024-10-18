// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostDraft} from 'mattermost-webapp/src/types/store/draft';

import type {Draft} from './drafts';
import type {Post, PostMetadata, PostPriority} from './posts';
import type {FileInfo} from "src/files";

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

    // return {
    //     message: scheduledPost.message,
    //     file_ids: scheduledPost.file_ids,
    //
    //
    //     is_pinned: false,
    //     original_id: '',
    //     pending_post_id: '',
    //     reply_count: 0,
    //     type: '',
    //     id: '',
    //     create_at: scheduledPost.create_at,
    //     update_at: 0,
    //     edit_at: 0,
    //     delete_at: 0,
    //     user_id: scheduledPost.user_id,
    //     channel_id: scheduledPost.channel_id,
    //     root_id: scheduledPost.root_id,
    //     props: scheduledPost.props,
    //     metadata: scheduledPost.metadata || {} as PostMetadata,
    // };
}

export function postDraftToScheduledPost(postDraft: PostDraft, userId: string, scheduledAt: number): ScheduledPost {
    const metadata = {} as PostMetadata;
    if (postDraft.metadata?.priority) {
        metadata.priority = postDraft.metadata.priority;
    }

    return {
        id: '',
        scheduled_at: scheduledAt,
        create_at: 0,
        update_at: 0,
        user_id: userId,
        channel_id: postDraft.channelId,
        root_id: postDraft.rootId,
        message: postDraft.message,
        props: postDraft.props,
        file_ids: postDraft.fileInfos.map((fileInfo) => fileInfo.id),
        priority: postDraft.metadata?.priority,
        metadata,
    };
}
