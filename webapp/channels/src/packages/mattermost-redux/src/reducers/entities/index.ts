// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {Post, PostsState} from '@mattermost/types/posts';
import type {SearchState} from '@mattermost/types/search';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {PostTypes} from 'mattermost-redux/action_types';

import admin from './admin';
import apps from './apps';
import bots from './bots';
import channelBookmarks from './channel_bookmarks';
import channelCategories from './channel_categories';
import channels from './channels';
import cloud from './cloud';
import contentFlagging from './content_flagging';
import emojis from './emojis';
import files from './files';
import general from './general';
import groups from './groups';
import hostedCustomer from './hosted_customer';
import integrations from './integrations';
import jobs from './jobs';
import limits from './limits';
import posts from './posts';
import preferences from './preferences';
import roles from './roles';
import scheduledPosts from './scheduled_posts';
import schemes from './schemes';
import search from './search';
import sharedChannels from './shared_channels';
import teams from './teams';
import threads from './threads';
import typing from './typing';
import usage from './usage';
import users from './users';

const entitiesReducers = combineReducers({
    general,
    users,
    limits,
    teams,
    channels,
    posts,
    files,
    preferences,
    typing,
    integrations,
    emojis,
    admin,
    jobs,
    search,
    roles,
    schemes,
    groups,
    bots,
    threads,
    channelCategories,
    apps,
    cloud,
    usage,
    hostedCustomer,
    channelBookmarks,
    scheduledPosts,
    sharedChannels,
    contentFlagging,
});

type EntitiesState = ReturnType<typeof entitiesReducers>;

function handleFileRemovalFromPost(searchState: SearchState, action: MMReduxAction, postsState: PostsState) {
    const updatedPost: Post = action.data;
    const {posts} = postsState;

    if (posts[updatedPost.id] && posts[updatedPost.id]?.file_ids) {
        const oldPostFileIds = new Set(posts[updatedPost.id].file_ids);
        const updatedPostFileIds = new Set(updatedPost.file_ids);
        const getDeletedFiles = (oldPostFileIds: Set<string>, updatedPostFileIds: Set<string>) => {
            const deletedFileIds = new Set();
            for (const fileId of oldPostFileIds) {
                if (!updatedPostFileIds.has(fileId)) {
                    deletedFileIds.add(fileId);
                }
            }
            return deletedFileIds;
        }

        // using this function instead of set.prototype.difference because the latest version of node (25)
        // doesn't support it. Testing errors with message that difference is not a function
        const deletedFileIds = getDeletedFiles(oldPostFileIds, updatedPostFileIds);
        const updatedFileResults = searchState.fileResults.filter((fileId) => !deletedFileIds.has(fileId));

        return {
            ...searchState,
            fileResults: updatedFileResults,
        };
    }

    return searchState;
}

function handleDeletePost(searchState: SearchState, action: MMReduxAction, postsState: PostsState) {
    const updatedPost: Post = action.data;
    const {posts} = postsState;

    if (posts[updatedPost.id] && posts[updatedPost.id]?.file_ids) {
        const updatedPostFileIds = new Set(updatedPost.file_ids);
        const updatedFileResults = searchState.fileResults.filter((fileId) => !updatedPostFileIds.has(fileId));

        return {
            ...searchState,
            fileResults: updatedFileResults,
        };
    }

    return searchState;
}

function fileRemovalFromSearchResults(state: EntitiesState, action: MMReduxAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_POST: {
        return {
            ...state,
            search: handleFileRemovalFromPost(state.search, action, state.posts),
        };
    }
    case PostTypes.POST_DELETED: {
        return {
            ...state,
            search: handleDeletePost(state.search, action, state.posts),
        };
    }
    default:
        return state;
    }
}

export default function entities(state: EntitiesState, action: MMReduxAction) {
    const intermediateState = fileRemovalFromSearchResults(state, action);
    return entitiesReducers(intermediateState, action);
}
