// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';
import type {PostPriority, PostType} from '@mattermost/types/posts';
import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {PostTypes} from 'utils/constants';

export type DraftInfo = {
    id: string;
    type: 'channel' | 'thread';
}

export type PostDraft = {
    message: string;
    message_source?: string;
    fileInfos: FileInfo[];
    file_ids?: string[];
    uploadsInProgress: string[];
    props?: any;
    caretPosition?: number;
    channelId: string;
    rootId: string;
    createAt: number;
    updateAt: number;
    show?: boolean;
    type?: PostType;
    metadata?: {
        priority?: {
            priority: PostPriority|'';
            requested_ack?: boolean;
            persistent_notifications?: boolean;
        };
        files?: FileInfo[];
    };
};

export function isPostDraftEmpty(draft: PostDraft): boolean {
    const hasMessage = draft.message.trim() !== '';
    const hasAttachment = draft.fileInfos?.length > 0;
    const hasUploadingFiles = draft.uploadsInProgress?.length > 0;

    // Check for priority metadata
    const hasPriority = draft.metadata?.priority && (
        draft.metadata.priority.priority ||
        draft.metadata.priority.requested_ack ||
        draft.metadata.priority.persistent_notifications
    );

    // Check for burn-on-read
    const hasBurnOnRead = draft.type === PostTypes.BURN_ON_READ;

    return !hasMessage && !hasAttachment && !hasUploadingFiles && !hasPriority && !hasBurnOnRead;
}

export function scheduledPostToPostDraft(scheduledPost: ScheduledPost): PostDraft {
    return {
        message: scheduledPost.message,
        fileInfos: scheduledPost.metadata?.files || [],
        uploadsInProgress: [],
        props: scheduledPost.props,
        channelId: scheduledPost.channel_id,
        rootId: scheduledPost.root_id,
        type: scheduledPost.type,
        createAt: 0,
        updateAt: 0,
        metadata: {
            priority: scheduledPost.priority,
        },
    };
}
