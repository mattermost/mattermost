// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {ActionTypes} from 'utils/constants';

import type {ViewsState} from 'types/store/views';

export default function rhsSuppressed(state: ViewsState['rhsSuppressed'] = false, action: GenericAction): boolean {
    switch (action.type) {
    case ActionTypes.SUPPRESS_RHS:
        return true;
    case ActionTypes.UNSUPPRESS_RHS:
        return false;

    // if RHS is to be opened stop supressing RHS
    case ActionTypes.UPDATE_RHS_STATE:
        if (action.state === null) {
            return state;
        }
        return false;
    case ActionTypes.SELECT_POST:
    case ActionTypes.SELECT_POST_CARD:
        if (action.postId === '') {
            return state;
        }
        return false;

    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}
