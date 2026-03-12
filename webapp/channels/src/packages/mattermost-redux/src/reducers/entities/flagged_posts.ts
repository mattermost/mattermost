// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {PreferenceType} from '@mattermost/types/preferences';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {FlaggedPostsTypes, PostTypes, PreferenceTypes, UserTypes} from 'mattermost-redux/action_types';
import {Preferences} from 'mattermost-redux/constants';
import {FLAGGED_POSTS_PER_PAGE} from 'mattermost-redux/constants/flagged_posts';

function postIds(state: string[] = [], action: MMReduxAction): string[] {
    switch (action.type) {
    case FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED:
        return action.data.postIds;

    case FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED:
        return [...new Set([...state, ...action.data.postIds])];

    case PostTypes.POST_REMOVED: {
        const postId = action.data?.id;
        const index = state.indexOf(postId);
        if (index !== -1) {
            const newState = [...state];
            newState.splice(index, 1);
            return newState;
        }
        return state;
    }

    case PreferenceTypes.RECEIVED_PREFERENCES: {
        if (!action.data) {
            return state;
        }
        const nextState = [...state];
        let hasNewFlaggedPosts = false;
        action.data.forEach((pref: PreferenceType) => {
            if (pref.category === Preferences.CATEGORY_FLAGGED_POST) {
                if (!nextState.includes(pref.name)) {
                    hasNewFlaggedPosts = true;
                    nextState.unshift(pref.name);
                }
            }
        });
        return hasNewFlaggedPosts ? nextState : state;
    }

    case PreferenceTypes.DELETED_PREFERENCES: {
        if (!action.data) {
            return state;
        }
        const nextState = [...state];
        let flaggedPostsRemoved = false;
        action.data.forEach((pref: PreferenceType) => {
            if (pref.category === Preferences.CATEGORY_FLAGGED_POST) {
                const index = nextState.indexOf(pref.name);
                if (index !== -1) {
                    flaggedPostsRemoved = true;
                    nextState.splice(index, 1);
                }
            }
        });
        return flaggedPostsRemoved ? nextState : state;
    }

    case FlaggedPostsTypes.FLAGGED_POSTS_CLEAR:
    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function page(state = 0, action: MMReduxAction): number {
    switch (action.type) {
    case FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED:
        return action.data.page;
    case FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED:
        return action.data.page;
    case FlaggedPostsTypes.FLAGGED_POSTS_CLEAR:
    case UserTypes.LOGOUT_SUCCESS:
        return 0;
    default:
        return state;
    }
}

function perPage(state = FLAGGED_POSTS_PER_PAGE, action: MMReduxAction): number {
    switch (action.type) {
    case FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED:
    case FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED:
        return action.data.perPage;
    case UserTypes.LOGOUT_SUCCESS:
        return FLAGGED_POSTS_PER_PAGE;
    default:
        return state;
    }
}

function isEnd(state = false, action: MMReduxAction): boolean {
    switch (action.type) {
    case FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED:
    case FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED:
        return action.data.isEnd;
    case FlaggedPostsTypes.FLAGGED_POSTS_CLEAR:
    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

function isLoading(state = false, action: MMReduxAction): boolean {
    switch (action.type) {
    case FlaggedPostsTypes.FLAGGED_POSTS_REQUEST:
        return true;
    case FlaggedPostsTypes.FLAGGED_POSTS_SUCCESS:
    case FlaggedPostsTypes.FLAGGED_POSTS_FAILURE:
        return false;
    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

function isLoadingMore(state = false, action: MMReduxAction): boolean {
    switch (action.type) {
    case FlaggedPostsTypes.FLAGGED_POSTS_MORE_REQUEST:
        return true;
    case FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED:
    case FlaggedPostsTypes.FLAGGED_POSTS_FAILURE:
        return false;
    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

export default combineReducers({
    postIds,
    page,
    perPage,
    isEnd,
    isLoading,
    isLoadingMore,
});
