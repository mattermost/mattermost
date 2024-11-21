// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';
import type {PostPriority} from '@mattermost/types/posts';
import type {ScheduledPost} from '@mattermost/types/schedule_post';

export type DraftInfo = {
    id: string;
    type: 'channel' | 'thread';
}

export type PostDraft = {
    message: string;
    fileInfos: FileInfo[];
    uploadsInProgress: string[];
    props?: any;
    caretPosition?: number;
    channelId: string;
    rootId: string;
    createAt: number;
    updateAt: number;
    show?: boolean;
    metadata?: {
        priority?: {
            priority: PostPriority|'';
            requested_ack?: boolean;
            persistent_notifications?: boolean;
        };
    };
};

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
