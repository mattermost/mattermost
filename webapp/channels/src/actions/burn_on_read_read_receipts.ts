// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';

import type {DispatchFunc} from 'types/store';

export interface BurnOnReadRevealedData {
    post_id: string;
    user_id: string;
    channel_id: string;
    total_recipients: number;
    revealed_count: number;
}

/**
 * Action dispatched when a WebSocket event indicates a user has revealed a burn-on-read post.
 * Updates the read receipt count for the specified post.
 */
export function handleBurnOnReadPostRevealed(data: BurnOnReadRevealedData) {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: PostTypes.BURN_ON_READ_POST_REVEALED,
            data: {
                postId: data.post_id,
                userId: data.user_id,
                channelId: data.channel_id,
                totalRecipients: data.total_recipients,
                revealedCount: data.revealed_count,
            },
        });

        return {data: true};
    };
}
