// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {PreferenceType} from '@mattermost/types/preferences';

import {PostTypes, PreferenceTypes, SearchTypes, UserTypes} from 'mattermost-redux/action_types';
import {Preferences} from 'mattermost-redux/constants';

function results(state: string[] = [], action: AnyAction) {
    switch (action.type) {
    case SearchTypes.RECEIVED_SEARCH_POSTS: {
        if (action.isGettingMore) {
            return [...new Set(state.concat(action.data.order))];
        }
        return action.data.order;
    }
    case PostTypes.POST_REMOVED: {
        const postId = action.data ? action.data.id : null;
        const index = state.indexOf(postId);
        if (index !== -1) {
            const newState = [...state];
            newState.splice(index, 1);
            return newState;
        }
        return state;
    }
    case SearchTypes.REMOVE_SEARCH_POSTS:
    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function fileResults(state: string[] = [], action: AnyAction) {
    switch (action.type) {
    case SearchTypes.RECEIVED_SEARCH_FILES: {
        if (action.isGettingMore) {
            return [...new Set(state.concat(action.data.order))];
        }
        return action.data.order;
    }
    case SearchTypes.REMOVE_SEARCH_FILES:
    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function matches(state: Record<string, string[]> = {}, action: AnyAction) {
    switch (action.type) {
    case SearchTypes.RECEIVED_SEARCH_POSTS:
        if (action.isGettingMore) {
            return Object.assign({}, state, action.data.matches);
        }
        return action.data.matches || {};
    case PostTypes.POST_REMOVED: {
        if (!state[action.data.id]) {
            return state;
        }

        const newState = {...state};
        Reflect.deleteProperty(newState, action.data.id);
        return newState;
    }
    case SearchTypes.REMOVE_SEARCH_POSTS:
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function flagged(state: string[] = [], action: AnyAction) {
    switch (action.type) {
    case SearchTypes.RECEIVED_SEARCH_FLAGGED_POSTS: {
        return action.data.order;
    }
    case PostTypes.POST_REMOVED: {
        const postId = action.data ? action.data.id : null;
        const index = state.indexOf(postId);
        if (index !== -1) {
            const newState = [...state];
            newState.splice(index, 1);
            return newState;
        }
        return state;
    }
    case PreferenceTypes.RECEIVED_PREFERENCES: {
        if (action.data) {
            const nextState = [...state];
            let hasNewFlaggedPosts = false;
            action.data.forEach((pref: PreferenceType) => {
                if (pref.category === Preferences.CATEGORY_FLAGGED_POST) {
                    const exists = nextState.find((p) => p === pref.name);
                    if (!exists) {
                        hasNewFlaggedPosts = true;
                        nextState.unshift(pref.name);
                    }
                }
            });

            return hasNewFlaggedPosts ? nextState : state;
        }

        return state;
    }
    case PreferenceTypes.DELETED_PREFERENCES: {
        if (action.data) {
            const nextState = [...state];
            let flaggedPostsRemoved = false;
            action.data.forEach((pref: PreferenceType) => {
                if (pref.category === Preferences.CATEGORY_FLAGGED_POST) {
                    const index = state.indexOf(pref.name);
                    if (index !== -1) {
                        flaggedPostsRemoved = true;
                        nextState.splice(index, 1);
                    }
                }
            });

            return flaggedPostsRemoved ? nextState : state;
        }

        return state;
    }
    case SearchTypes.REMOVE_SEARCH_POSTS:
    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function removePinnedPost(state: Record<string, string[]>, post: Post) {
    if (post && state[post.channel_id]) {
        const postId = post.id;
        const channelId = post.channel_id;
        const pinnedPosts = [...state[channelId]];
        const index = pinnedPosts.indexOf(postId);

        if (index !== -1) {
            pinnedPosts.splice(index, 1);
            return {
                ...state,
                [channelId]: pinnedPosts,
            };
        }
    }

    return state;
}

function pinned(state: Record<string, string[]> = {}, action: AnyAction) {
    switch (action.type) {
    case SearchTypes.RECEIVED_SEARCH_PINNED_POSTS: {
        const {channelId, pinned: posts} = action.data;
        return {
            ...state,
            [channelId]: posts.order.reverse(),
        };
    }
    case PostTypes.POST_DELETED:
    case PostTypes.POST_REMOVED: {
        return removePinnedPost(state, action.data);
    }
    case PostTypes.RECEIVED_POST: {
        const post = action.data;
        if (post && post.is_pinned) {
            const channelId = post.channel_id;
            let pinnedPosts: string[] = [];

            if (state[channelId]) {
                pinnedPosts = [...state[channelId]];
            }

            if (!pinnedPosts.includes(post.id)) {
                pinnedPosts.unshift(post.id);
            }

            return {
                ...state,
                [channelId]: pinnedPosts,
            };
        }

        return removePinnedPost(state, action.data);
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function current(state: any = {}, action: AnyAction) {
    const {data, type} = action;
    switch (type) {
    case SearchTypes.RECEIVED_SEARCH_TERM: {
        const nextState = {...state};
        const {teamId, params, isEnd, isFilesEnd} = data;
        return {
            ...nextState,
            [teamId]: {
                params,
                isEnd: typeof isEnd === 'undefined' && state[teamId] ? state[teamId].isEnd : isEnd,
                isFilesEnd: typeof isFilesEnd === 'undefined' && state[teamId] ? state[teamId].isFilesEnd : isFilesEnd,
            },
        };
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function isSearchingTerm(state = false, action: AnyAction) {
    switch (action.type) {
    case SearchTypes.SEARCH_POSTS_REQUEST:
        return !action.isGettingMore;
    case SearchTypes.SEARCH_POSTS_SUCCESS:
        return false;
    default:
        return state;
    }
}

function isSearchGettingMore(state = false, action: AnyAction) {
    switch (action.type) {
    case SearchTypes.SEARCH_POSTS_REQUEST:
        return action.isGettingMore;
    case SearchTypes.SEARCH_POSTS_SUCCESS:
        return false;
    default:
        return state;
    }
}

function isLimitedResults(state = -1, action: AnyAction): number {
    switch (action.type) {
    case SearchTypes.SEARCH_POSTS_REQUEST: {
        if (!action.isGettingMore) {
            return -1;
        }
        return state;
    }
    case SearchTypes.RECEIVED_SEARCH_POSTS: {
        if (action.data?.first_inaccessible_post_time) {
            return action.data.first_inaccessible_post_time || 0;
        }
        return state;
    }
    default: {
        return state;
    }
    }
}

export default combineReducers({

    // An ordered array with posts ids of flagged posts
    flagged,

    // An Object where every key is a channel id mapping to an ordered array with posts ids of pinned posts
    pinned,

    // An ordered array with posts ids from the search results
    results,

    // An ordered array with files ids from the search results
    fileResults,

    // Object where every key is a post id mapping to an array of matched words in that post
    matches,

    // Object holding the current searches for every team
    current,

    // Boolean true if we are are searching initally
    isSearchingTerm,

    // Boolean true if we are getting more search results
    isSearchGettingMore,

    // Boolean true if the search returns results inaccessible because
    // they are beyond a cloud workspace's message limits.
    isLimitedResults,
});
