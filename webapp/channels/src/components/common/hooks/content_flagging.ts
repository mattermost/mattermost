// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import type {ContentFlaggingChannelRequestIdentifier} from 'mattermost-redux/actions/content_flagging';
import {
    loadContentFlaggingChannel,
    loadFlaggedPost,
} from 'mattermost-redux/actions/content_flagging';
import {getContentFlaggingChannel, getFlaggedPost} from 'mattermost-redux/selectors/entities/content_flagging';

import {makeUseEntity} from 'components/common/hooks/useEntity';

export const useGetFlaggedPost = makeUseEntity<Post | undefined>({
    name: 'useGetFlaggedPost',
    fetch: loadFlaggedPost,
    selector: getFlaggedPost,
});

export const useGetContentFlaggingChannel = makeUseEntity<Channel | undefined, ContentFlaggingChannelRequestIdentifier>({
    name: 'useGetContentFlaggingChannel',
    fetch: loadContentFlaggingChannel,
    selector: getContentFlaggingChannel,
});
