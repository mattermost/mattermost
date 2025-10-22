// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/constants/posts';

import type {DraftInfo} from 'types/store/draft';

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

    if (prefix === StoragePrefixes.PAGE_DRAFT) {
        return {
            id: keyArr.slice(2).join('_'),
            type: PostTypes.PAGE as 'page',
        };
    }

    return null;
}
