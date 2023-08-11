// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {PostsRequestsStatuses, RequestStatusType} from '@mattermost/types/requests';

import {PostTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {handleRequest, initialRequestState} from './helpers';

function createPost(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    if (action.type === PostTypes.CREATE_POST_RESET_REQUEST) {
        return initialRequestState();
    }

    return handleRequest(
        PostTypes.CREATE_POST_REQUEST,
        PostTypes.CREATE_POST_SUCCESS,
        PostTypes.CREATE_POST_FAILURE,
        state,
        action,
    );
}

function editPost(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    return handleRequest(
        PostTypes.EDIT_POST_REQUEST,
        PostTypes.EDIT_POST_SUCCESS,
        PostTypes.EDIT_POST_FAILURE,
        state,
        action,
    );
}

function getPostThread(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    return handleRequest(
        PostTypes.GET_POST_THREAD_REQUEST,
        PostTypes.GET_POST_THREAD_SUCCESS,
        PostTypes.GET_POST_THREAD_FAILURE,
        state,
        action,
    );
}

export default (combineReducers({
    createPost,
    editPost,
    getPostThread,
}) as (b: PostsRequestsStatuses, a: GenericAction) => PostsRequestsStatuses);
