// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {isPostEphemeral} from 'mattermost-redux/utils/post_utils';

import {isAddMemberProps} from 'components/post_markdown/system_message_helpers';

import {ActionTypes} from 'utils/constants';
import {getSuppressOutOfChannelEphemeralKey} from 'utils/out_of_channel_mention_ephemeral';

import type {ActionFunc, GlobalState} from 'types/store';

export {getSuppressOutOfChannelEphemeralKey} from 'utils/out_of_channel_mention_ephemeral';

export const OUT_OF_CHANNEL_EPHEMERAL_SUPPRESS_TTL_MS = 10000;

export type SuppressOutOfChannelEphemeral = {
    channelId: string;
    rootId: string;
    expireAt: number;
};

export function suppressOutOfChannelEphemeralPost(channelId: string, rootId = ''): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.SUPPRESS_OUT_OF_CHANNEL_EPHEMERAL,
            data: {
                channelId,
                rootId,
                expireAt: Date.now() + OUT_OF_CHANNEL_EPHEMERAL_SUPPRESS_TTL_MS,
            },
        });
        return {data: true};
    };
}

export function getSuppressOutOfChannelEphemeral(state: GlobalState, channelId: string, rootId = ''): SuppressOutOfChannelEphemeral | null {
    const key = getSuppressOutOfChannelEphemeralKey(channelId, rootId);
    const entry = state.views.posts.suppressOutOfChannelEphemeral[key];
    if (!entry || Date.now() >= entry.expireAt) {
        return null;
    }

    return {
        channelId,
        rootId,
        expireAt: entry.expireAt,
    };
}

export function isOutOfChannelMentionEphemeralPost(post: {props?: Post['props']}): boolean {
    return isAddMemberProps(post.props?.add_channel_member);
}

export function shouldSuppressOutOfChannelEphemeralPost(state: GlobalState, post: {channel_id: string; root_id?: string; type?: string; props?: Post['props']}): boolean {
    if (!isPostEphemeral(post as Parameters<typeof isPostEphemeral>[0])) {
        return false;
    }

    if (!isOutOfChannelMentionEphemeralPost(post)) {
        return false;
    }

    return getSuppressOutOfChannelEphemeral(state, post.channel_id, post.root_id || '') !== null;
}
