// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {RequestStatusType} from '@mattermost/types/requests';

import {SearchTypes} from 'mattermost-redux/action_types';

import {handleRequest, initialRequestState} from './helpers';

function flaggedPosts(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    if (action.type === SearchTypes.REMOVE_SEARCH_POSTS) {
        return initialRequestState();
    }

    return handleRequest(
        SearchTypes.SEARCH_FLAGGED_POSTS_REQUEST,
        SearchTypes.SEARCH_FLAGGED_POSTS_SUCCESS,
        SearchTypes.SEARCH_FLAGGED_POSTS_FAILURE,
        state,
        action,
    );
}

function pinnedPosts(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    if (action.type === SearchTypes.REMOVE_SEARCH_POSTS) {
        return initialRequestState();
    }

    return handleRequest(
        SearchTypes.SEARCH_PINNED_POSTS_REQUEST,
        SearchTypes.SEARCH_PINNED_POSTS_SUCCESS,
        SearchTypes.SEARCH_PINNED_POSTS_FAILURE,
        state,
        action,
    );
}

export default combineReducers({
    flaggedPosts,
    pinnedPosts,
});
