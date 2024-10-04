// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';
import type {PostPriority} from '@mattermost/types/posts';

export type DraftInfo = {
    id: string;
    type: 'channel' | 'thread';
}

/**
 * PostDraft is the used for storing post drafts in Redux state and in browser storage. It's different from the
 * ServerDraft type defined in @mattermost/types which is used by the server's draft APIs.
 */
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

export function isDraftEmpty(draft: PostDraft) {
    return draft.message === '' && draft.fileInfos.length === 0 && draft.uploadsInProgress.length === 0;
}
