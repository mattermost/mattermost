// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DraftInfo, PostDraft} from 'types/store/draft';

import {StoragePrefixes} from './constants';

export function getDraftInfoFromKey(key: string, prefix: string): DraftInfo | null {
    const keyArr = key.split('_');
    if (prefix === StoragePrefixes.DRAFT) {
        return {
            id: keyArr[1],
            type: 'channel',
        };
    }

    if (prefix === StoragePrefixes.COMMENT_DRAFT) {
        return {
            id: keyArr[2],
            type: 'thread',
        };
    }

    return null;
}

export function getDraftKey(channelId: string, rootId: string): string {
    let key = `${StoragePrefixes.DRAFT}${channelId}`;
    if (rootId) {
        key = `${StoragePrefixes.COMMENT_DRAFT}${rootId}`;
    }

    return key;
}

export function makeEmptyDraft(channelId: string, rootId: string): PostDraft {
    return {
        channelId,
        rootId,
        message: '',
        fileInfos: [],
        uploadsInProgress: [],
        createAt: 0,
        updateAt: 0,
    };
}

export function ensureDraft(partial: Partial<PostDraft> | undefined, channelId: string, rootId: string): PostDraft {
    return {
        ...makeEmptyDraft(channelId, rootId),
        ...partial,
    };
}
