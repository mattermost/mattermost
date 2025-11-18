// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BurnOnReadReadReceiptsState} from '@mattermost/types/burn_on_read_read_receipts';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {PostTypes} from 'mattermost-redux/action_types';

/**
 * Reducer for burn-on-read read receipts.
 */
export default function burnOnReadReadReceipts(state: BurnOnReadReadReceiptsState = {}, action: MMReduxAction): BurnOnReadReadReceiptsState {
    switch (action.type) {
    case PostTypes.BURN_ON_READ_POST_REVEALED: {
        const {postId, totalRecipients, revealedCount} = action.data;

        return {
            ...state,
            [postId]: {
                postId,
                totalRecipients,
                revealedCount,
                lastUpdated: Date.now(),
            },
        };
    }

    case PostTypes.POST_DELETED:
    case PostTypes.POST_REMOVED: {
        // Clean up read receipts when post is deleted
        const {id} = action.data;
        if (!state[id]) {
            return state;
        }

        const newState = {...state};
        delete newState[id];
        return newState;
    }

    default:
        return state;
    }
}
