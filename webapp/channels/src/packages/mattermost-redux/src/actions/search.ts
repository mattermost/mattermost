// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {Client4} from 'mattermost-redux/client';
import {SearchTypes} from 'mattermost-redux/action_types';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {ActionResult, DispatchFunc, GetStateFunc, ActionFunc} from 'mattermost-redux/types/actions';

import {PostList} from '@mattermost/types/posts';

import {FileSearchResults, FileSearchResultItem} from '@mattermost/types/files';

import {SearchParameter} from '@mattermost/types/search';

import {getChannelAndMyMember, getChannelMembers} from './channels';
import {forceLogoutIfNecessary} from './helpers';
import {logError} from './errors';
import {getProfilesAndStatusesForPosts, receivedPosts} from './posts';
import {receivedFiles} from './files';

const WEBAPP_SEARCH_PER_PAGE = 20;

export function getMissingChannelsFromPosts(posts: PostList['posts']): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {
            channels,
            membersInChannel,
            myMembers,
        } = getState().entities.channels;
        const promises: Array<Promise<ActionResult>> = [];
        Object.values(posts).forEach((post) => {
            const id = post.channel_id;

            if (!channels[id] || !myMembers[id]) {
                promises.push(dispatch(getChannelAndMyMember(id)));
            }

            if (!membersInChannel[id]) {
                promises.push(dispatch(getChannelMembers(id)));
            }
        });
        return Promise.all(promises);
    };
}

export function getMissingChannelsFromFiles(files: Map<string, FileSearchResultItem>): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {
            channels,
            membersInChannel,
            myMembers,
        } = getState().entities.channels;
        const promises: Array<Promise<ActionResult>> = [];
        Object.values(files).forEach((file) => {
            const id = file.channel_id;

            if (!channels[id] || !myMembers[id]) {
                promises.push(dispatch(getChannelAndMyMember(id)));
            }

            if (!membersInChannel[id]) {
                promises.push(dispatch(getChannelMembers(id)));
            }
        });
        return Promise.all(promises);
    };
}

export function searchPostsWithParams(teamId: string, params: SearchParameter): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const isGettingMore = params.page > 0;
        dispatch({
            type: SearchTypes.SEARCH_POSTS_REQUEST,
            isGettingMore,
        });
        let posts;

        try {
            posts = await Client4.searchPostsWithParams(teamId, params);

            const profilesAndStatuses = getProfilesAndStatusesForPosts(posts.posts, dispatch, getState);
            const missingChannels = dispatch(getMissingChannelsFromPosts(posts.posts));
            const arr: [Promise<any>, Promise<any>] = [profilesAndStatuses, missingChannels];
            await Promise.all(arr);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: SearchTypes.RECEIVED_SEARCH_POSTS,
                data: posts,
                isGettingMore,
            },
            receivedPosts(posts),
            {
                type: SearchTypes.RECEIVED_SEARCH_TERM,
                data: {
                    teamId,
                    params,
                    isEnd: posts.order.length === 0,
                },
            },
            {
                type: SearchTypes.SEARCH_POSTS_SUCCESS,
            },
        ], 'SEARCH_POST_BATCH'));

        return {data: posts};
    };
}

export function searchPosts(teamId: string, terms: string, isOrSearch: boolean, includeDeletedChannels: boolean) {
    return searchPostsWithParams(teamId, {terms, is_or_search: isOrSearch, include_deleted_channels: includeDeletedChannels, page: 0, per_page: WEBAPP_SEARCH_PER_PAGE});
}

export function getMorePostsForSearch(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const teamId = getCurrentTeamId(getState());
        const {params, isEnd} = getState().entities.search.current[teamId];
        if (!isEnd) {
            const newParams = Object.assign({}, params);
            newParams.page += 1;
            return dispatch(searchPostsWithParams(teamId, newParams));
        }
        return {data: true};
    };
}

export function clearSearch(): ActionFunc {
    return async (dispatch) => {
        dispatch({type: SearchTypes.REMOVE_SEARCH_POSTS});
        dispatch({type: SearchTypes.REMOVE_SEARCH_FILES});

        return {data: true};
    };
}

export function searchFilesWithParams(teamId: string, params: SearchParameter): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const isGettingMore = params.page > 0;
        dispatch({
            type: SearchTypes.SEARCH_FILES_REQUEST,
            isGettingMore,
        });

        let files: FileSearchResults;
        try {
            files = await Client4.searchFilesWithParams(teamId, params);

            await dispatch(getMissingChannelsFromFiles(files.file_infos));
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: SearchTypes.RECEIVED_SEARCH_FILES,
                data: files,
                isGettingMore,
            },
            receivedFiles(files.file_infos),
            {
                type: SearchTypes.RECEIVED_SEARCH_TERM,
                data: {
                    teamId,
                    params,
                    isFilesEnd: files.order.length === 0,
                },
            },
            {
                type: SearchTypes.SEARCH_FILES_SUCCESS,
            },
        ], 'SEARCH_FILE_BATCH'));

        return {data: files};
    };
}

export function searchFiles(teamId: string, terms: string, isOrSearch: boolean, includeDeletedChannels: boolean) {
    return searchFilesWithParams(teamId, {terms, is_or_search: isOrSearch, include_deleted_channels: includeDeletedChannels, page: 0, per_page: WEBAPP_SEARCH_PER_PAGE});
}

export function getMoreFilesForSearch(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const teamId = getCurrentTeamId(getState());
        const {params, isFilesEnd} = getState().entities.search.current[teamId];
        if (!isFilesEnd) {
            const newParams = Object.assign({}, params);
            newParams.page += 1;
            return dispatch(searchFilesWithParams(teamId, newParams));
        }
        return {data: true};
    };
}

export function getFlaggedPosts(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const userId = getCurrentUserId(state);

        dispatch({type: SearchTypes.SEARCH_FLAGGED_POSTS_REQUEST});

        let posts;
        try {
            posts = await Client4.getFlaggedPosts(userId);

            await Promise.all([getProfilesAndStatusesForPosts(posts.posts, dispatch, getState) as any, dispatch(getMissingChannelsFromPosts(posts.posts)) as any]);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: SearchTypes.SEARCH_FLAGGED_POSTS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: SearchTypes.RECEIVED_SEARCH_FLAGGED_POSTS,
                data: posts,
            },
            receivedPosts(posts),
            {
                type: SearchTypes.SEARCH_FLAGGED_POSTS_SUCCESS,
            },
        ], 'SEARCH_FLAGGED_POSTS_BATCH'));

        return {data: posts};
    };
}

export function getPinnedPosts(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        dispatch({type: SearchTypes.SEARCH_PINNED_POSTS_REQUEST});

        let result;
        try {
            result = await Client4.getPinnedPosts(channelId);

            const profilesAndStatuses = getProfilesAndStatusesForPosts(result.posts, dispatch, getState);
            const missingChannels = dispatch(getMissingChannelsFromPosts(result.posts));
            const arr: [Promise<any>, Promise<any>] = [profilesAndStatuses, missingChannels];
            await Promise.all(arr);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: SearchTypes.SEARCH_PINNED_POSTS_FAILURE, error});
            return {error};
        }

        dispatch(batchActions([
            {
                type: SearchTypes.RECEIVED_SEARCH_PINNED_POSTS,
                data: {
                    pinned: result,
                    channelId,
                },
            },
            receivedPosts(result),
            {
                type: SearchTypes.SEARCH_PINNED_POSTS_SUCCESS,
            },
        ], 'SEARCH_PINNED_POSTS_BATCH'));

        return {data: result};
    };
}

export function clearPinnedPosts(channelId: string): ActionFunc {
    return async (dispatch) => {
        dispatch({
            type: SearchTypes.REMOVE_SEARCH_PINNED_POSTS,
            data: {
                channelId,
            },
        });

        return {data: true};
    };
}

export function removeSearchTerms(teamId: string, terms: string): ActionFunc {
    return async (dispatch) => {
        dispatch({
            type: SearchTypes.REMOVE_SEARCH_TERM,
            data: {
                teamId,
                terms,
            },
        });

        return {data: true};
    };
}

export default {
    clearSearch,
    removeSearchTerms,
    searchPosts,
};
