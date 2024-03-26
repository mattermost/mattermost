// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {Post} from '@mattermost/types/posts';

import {SearchTypes} from 'mattermost-redux/action_types';
import {getChannel} from 'mattermost-redux/actions/channels';
import {getPostsByIds, getPost as fetchPost} from 'mattermost-redux/actions/posts';
import {
    clearSearch,
    getFlaggedPosts,
    getPinnedPosts,
    searchPostsWithParams,
    searchFilesWithParams,
} from 'mattermost-redux/actions/search';
import {getCurrentChannelId, getCurrentChannelNameForSearchShortcut, getChannel as getChannelSelector} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUser, getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getSearchTerms, getRhsState, getPluggableId, getFilesSearchExtFilter, getPreviousRhsState} from 'selectors/rhs';

import {SidebarSize} from 'components/resizable_sidebar/constants';

import {ActionTypes, RHSStates, Constants} from 'utils/constants';
import {getBrowserUtcOffset, getUtcOffsetForTimeZone} from 'utils/timezone';

import type {GlobalState} from 'types/store';
import type {RhsState} from 'types/store/rhs';

function selectPostFromRightHandSideSearchWithPreviousState(post: Post, previousRhsState?: RhsState): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const postRootId = post.root_id || post.id;
        const state = getState();

        dispatch({
            type: ActionTypes.SELECT_POST,
            postId: postRootId,
            channelId: post.channel_id,
            previousRhsState: previousRhsState || getRhsState(state),
            timestamp: Date.now(),
        });

        return {data: true};
    };
}

function selectPostCardFromRightHandSideSearchWithPreviousState(post: Post, previousRhsState?: RhsState): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();

        dispatch({
            type: ActionTypes.SELECT_POST_CARD,
            postId: post.id,
            channelId: post.channel_id,
            previousRhsState: previousRhsState || getRhsState(state),
        });

        return {data: true};
    };
}

export function updateRhsState(rhsState: string, channelId?: string, previousRhsState?: RhsState): ActionFunc<boolean> {
    return (dispatch, getState) => {
        const action: AnyAction = {
            type: ActionTypes.UPDATE_RHS_STATE,
            state: rhsState,
        };

        if ([
            RHSStates.PIN,
            RHSStates.CHANNEL_FILES,
            RHSStates.CHANNEL_INFO,
            RHSStates.CHANNEL_MEMBERS,
        ].includes(rhsState)) {
            action.channelId = channelId || getCurrentChannelId(getState());
        }
        if (previousRhsState) {
            action.previousRhsState = previousRhsState;
        }

        dispatch(action);

        return {data: true};
    };
}

export function openShowEditHistory(post: Post) {
    return {
        type: ActionTypes.UPDATE_RHS_STATE,
        state: RHSStates.EDIT_HISTORY,
        postId: post.id,
        channelId: post.channel_id,
        timestamp: Date.now(),
    };
}

export function goBack(): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const prevState = getPreviousRhsState(getState());
        const defaultTab = 'channel-info';

        dispatch({
            type: ActionTypes.RHS_GO_BACK,
            state: prevState || defaultTab,
        });

        return {data: true};
    };
}

export function selectPostFromRightHandSideSearch(post: Post) {
    return selectPostFromRightHandSideSearchWithPreviousState(post);
}

export function selectPostFromRightHandSideSearchByPostId(postId: string): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const post = getPost(getState(), postId);
        return dispatch(selectPostFromRightHandSideSearch(post));
    };
}

export function updateSearchTerms(terms: string) {
    return {
        type: ActionTypes.UPDATE_RHS_SEARCH_TERMS,
        terms,
    };
}

export function setRhsSize(rhsSize?: SidebarSize) {
    let newSidebarSize = rhsSize;
    if (!newSidebarSize) {
        const width = window.innerWidth;

        switch (true) {
        case width <= Constants.SMALL_SIDEBAR_BREAKPOINT: {
            newSidebarSize = SidebarSize.SMALL;
            break;
        }
        case width > Constants.SMALL_SIDEBAR_BREAKPOINT && width <= Constants.MEDIUM_SIDEBAR_BREAKPOINT: {
            newSidebarSize = SidebarSize.MEDIUM;
            break;
        }
        case width > Constants.MEDIUM_SIDEBAR_BREAKPOINT && width <= Constants.LARGE_SIDEBAR_BREAKPOINT: {
            newSidebarSize = SidebarSize.LARGE;
            break;
        }
        default: {
            newSidebarSize = SidebarSize.XLARGE;
        }
        }
    }
    return {
        type: ActionTypes.SET_RHS_SIZE,
        size: newSidebarSize,
    };
}

export function updateSearchTermsForShortcut(): ThunkActionFunc<unknown> {
    return (dispatch, getState) => {
        const currentChannelName = getCurrentChannelNameForSearchShortcut(getState());
        return dispatch(updateSearchTerms(`in:${currentChannelName} `));
    };
}

export function updateSearchType(searchType: string) {
    return {
        type: ActionTypes.UPDATE_RHS_SEARCH_TYPE,
        searchType,
    };
}

function updateSearchResultsTerms(terms: string) {
    return {
        type: ActionTypes.UPDATE_RHS_SEARCH_RESULTS_TERMS,
        terms,
    };
}

export function performSearch(terms: string, isMentionSearch?: boolean): ThunkActionFunc<unknown, GlobalState> {
    return (dispatch, getState) => {
        let searchTerms = terms;
        const teamId = getCurrentTeamId(getState());
        const config = getConfig(getState());
        const viewArchivedChannels = config.ExperimentalViewArchivedChannels === 'true';
        const extensionsFilters = getFilesSearchExtFilter(getState());

        const extensions = extensionsFilters?.map((ext) => `ext:${ext}`).join(' ');
        let termsWithExtensionsFilters = searchTerms;
        if (extensions?.trim().length > 0) {
            termsWithExtensionsFilters += ` ${extensions}`;
        }

        if (isMentionSearch) {
            // Username should be quoted to allow specific search
            // in case username is made with multiple words splitted by dashes or other symbols.
            const user = getCurrentUser(getState());
            const termsArr = searchTerms.split(' ').filter((t) => Boolean(t && t.trim()));
            const username = '@' + user.username;
            const quotedUsername = `"${username}"`;
            for (let i = 0; i < termsArr.length; i++) {
                if (termsArr[i] === username) {
                    termsArr[i] = quotedUsername;
                    break;
                }
            }
            searchTerms = termsArr.join(' ');
        }

        // timezone offset in seconds
        const userCurrentTimezone = getCurrentTimezone(getState());
        const timezoneOffset = ((userCurrentTimezone && (userCurrentTimezone.length > 0)) ? getUtcOffsetForTimeZone(userCurrentTimezone) : getBrowserUtcOffset()) * 60;
        const messagesPromise = dispatch(searchPostsWithParams(isMentionSearch ? '' : teamId, {terms: searchTerms, is_or_search: Boolean(isMentionSearch), include_deleted_channels: viewArchivedChannels, time_zone_offset: timezoneOffset, page: 0, per_page: 20}));
        const filesPromise = dispatch(searchFilesWithParams(teamId, {terms: termsWithExtensionsFilters, is_or_search: Boolean(isMentionSearch), include_deleted_channels: viewArchivedChannels, time_zone_offset: timezoneOffset, page: 0, per_page: 20}));
        return Promise.all([filesPromise, messagesPromise]);
    };
}

export function filterFilesSearchByExt(extensions: string[]) {
    return {
        type: ActionTypes.SET_FILES_FILTER_BY_EXT,
        data: extensions,
    };
}

export function showSearchResults(isMentionSearch = false): ThunkActionFunc<unknown, GlobalState> {
    return (dispatch, getState) => {
        const state = getState();

        const searchTerms = getSearchTerms(state);

        if (isMentionSearch) {
            dispatch(updateRhsState(RHSStates.MENTION));
        } else {
            dispatch(updateRhsState(RHSStates.SEARCH));
        }
        dispatch(updateSearchResultsTerms(searchTerms));

        return dispatch(performSearch(searchTerms));
    };
}

export function showRHSPlugin(pluggableId: string) {
    return {
        type: ActionTypes.UPDATE_RHS_STATE,
        state: RHSStates.PLUGIN,
        pluggableId,
    };
}

export function showChannelMembers(channelId: string, inEditingMode = false): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();

        if (inEditingMode) {
            await dispatch(setEditChannelMembers(true));
        }

        let previousRhsState = getRhsState(state);
        if (previousRhsState === RHSStates.CHANNEL_MEMBERS) {
            previousRhsState = getPreviousRhsState(state);
        }
        dispatch({
            type: ActionTypes.UPDATE_RHS_STATE,
            channelId,
            state: RHSStates.CHANNEL_MEMBERS,
            previousRhsState,
        });

        return {data: true};
    };
}

export function hideRHSPlugin(pluggableId: string): ActionFunc<boolean, GlobalState> {
    return (dispatch, getState) => {
        const state = getState() as GlobalState;

        if (getPluggableId(state) === pluggableId) {
            dispatch(closeRightHandSide());
        }

        return {data: true};
    };
}

export function toggleRHSPlugin(pluggableId: string): ActionFunc<boolean, GlobalState> {
    return (dispatch, getState) => {
        const state = getState();

        if (getPluggableId(state) === pluggableId) {
            dispatch(hideRHSPlugin(pluggableId));
            return {data: false};
        }

        dispatch(showRHSPlugin(pluggableId));
        return {data: true};
    };
}

export function showFlaggedPosts(): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const teamId = getCurrentTeamId(state);

        dispatch({
            type: ActionTypes.UPDATE_RHS_STATE,
            state: RHSStates.FLAG,
        });

        const results = await dispatch(getFlaggedPosts());
        let data;
        if ('data' in results) {
            data = results.data;
        }

        dispatch(batchActions([
            {
                type: SearchTypes.RECEIVED_SEARCH_POSTS,
                data,
            },
            {
                type: SearchTypes.RECEIVED_SEARCH_TERM,
                data: {
                    teamId,
                    terms: null,
                    isOrSearch: false,
                },
            },
        ]));

        return {data: true};
    };
}

export function showPinnedPosts(channelId?: string): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentChannelId = getCurrentChannelId(state);
        const teamId = getCurrentTeamId(state);

        let previousRhsState = getRhsState(state);
        if (previousRhsState === RHSStates.PIN) {
            previousRhsState = getPreviousRhsState(state);
        }
        dispatch({
            type: ActionTypes.UPDATE_RHS_STATE,
            channelId: channelId || currentChannelId,
            state: RHSStates.PIN,
            previousRhsState,
        });

        const results = await dispatch(getPinnedPosts(channelId || currentChannelId));

        let data;
        if ('data' in results) {
            data = results.data;
        }

        dispatch(batchActions([
            {
                type: SearchTypes.RECEIVED_SEARCH_POSTS,
                data,
            },
            {
                type: SearchTypes.RECEIVED_SEARCH_TERM,
                data: {
                    teamId,
                    terms: null,
                    isOrSearch: false,
                },
            },
        ]));

        return {data: true};
    };
}

export function showChannelFiles(channelId: string): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();
        const teamId = getCurrentTeamId(state);

        let previousRhsState = getRhsState(state);
        if (previousRhsState === RHSStates.CHANNEL_FILES) {
            previousRhsState = getPreviousRhsState(state);
        }
        dispatch({
            type: ActionTypes.UPDATE_RHS_STATE,
            channelId,
            state: RHSStates.CHANNEL_FILES,
            previousRhsState,
        });
        dispatch(updateSearchType('files'));

        const results = await dispatch(performSearch('channel:' + channelId));
        const fileData = results instanceof Array ? results[0].data : null;
        const missingPostIds: string[] = [];

        if (fileData) {
            Object.values(fileData.file_infos).forEach((file: any) => {
                const postId = file?.post_id;

                if (postId && !getPost(state, postId)) {
                    missingPostIds.push(postId);
                }
            });
        }
        if (missingPostIds.length > 0) {
            await dispatch(getPostsByIds(missingPostIds));
        }

        let data: any;
        if (results && results instanceof Array && results.length === 2 && 'data' in results[1]) {
            data = results[1].data;
        }

        dispatch(batchActions([
            {
                type: SearchTypes.RECEIVED_SEARCH_POSTS,
                data,
            },
            {
                type: SearchTypes.RECEIVED_SEARCH_TERM,
                data: {
                    teamId,
                    terms: null,
                    isOrSearch: false,
                },
            },
        ]));

        return {data: true};
    };
}

export function showMentions(): ActionFunc<boolean, GlobalState> {
    return (dispatch, getState) => {
        const termKeys = getCurrentUserMentionKeys(getState()).filter(({key}) => {
            return key !== '@channel' && key !== '@all' && key !== '@here';
        });

        const terms = termKeys.map(({key}) => key).join(' ').trim() + ' ';

        trackEvent('api', 'api_posts_search_mention');

        dispatch(performSearch(terms, true));
        dispatch(batchActions([
            {
                type: ActionTypes.UPDATE_RHS_SEARCH_TERMS,
                terms,
            },
            {
                type: ActionTypes.UPDATE_RHS_STATE,
                state: RHSStates.MENTION,
            },
        ]));

        return {data: true};
    };
}

export function showChannelInfo(channelId: string) {
    return {
        type: ActionTypes.UPDATE_RHS_STATE,
        channelId,
        state: RHSStates.CHANNEL_INFO,
    };
}

export function closeRightHandSide(): ActionFunc {
    return (dispatch) => {
        const actionsBatch: AnyAction[] = [
            {
                type: ActionTypes.UPDATE_RHS_STATE,
                state: null,
            },
            {
                type: ActionTypes.SELECT_POST,
                postId: '',
                channelId: '',
                timestamp: 0,
            },
        ];

        dispatch(batchActions(actionsBatch));
        return {data: true};
    };
}

export const toggleMenu = (): ThunkActionFunc<unknown> => (dispatch) => dispatch({
    type: ActionTypes.TOGGLE_RHS_MENU,
});

export const openMenu = (): ThunkActionFunc<unknown> => (dispatch) => dispatch({
    type: ActionTypes.OPEN_RHS_MENU,
});

export const closeMenu = (): ThunkActionFunc<unknown> => (dispatch) => dispatch({
    type: ActionTypes.CLOSE_RHS_MENU,
});

export function setRhsExpanded(expanded: boolean) {
    return {
        type: ActionTypes.SET_RHS_EXPANDED,
        expanded,
    };
}

export function toggleRhsExpanded() {
    return {
        type: ActionTypes.TOGGLE_RHS_EXPANDED,
    };
}

export function selectPost(post: Post) {
    return {
        type: ActionTypes.SELECT_POST,
        postId: post.root_id || post.id,
        channelId: post.channel_id,
        timestamp: Date.now(),
    };
}

export function selectPostById(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const post = getPost(state, postId) ?? (await dispatch(fetchPost(postId))).data;
        if (post) {
            const channel = getChannelSelector(state, post.channel_id);
            if (!channel) {
                await dispatch(getChannel(post.channel_id));
            }
            dispatch(selectPost(post));
            return {data: true};
        }
        return {data: false};
    };
}

export function highlightReply(post: Post) {
    return {
        type: ActionTypes.HIGHLIGHT_REPLY,
        postId: post.id,
    };
}

export const clearHighlightReply = {
    type: ActionTypes.CLEAR_HIGHLIGHT_REPLY,
};

export const debouncedClearHighlightReply = debounce((dispatch) => {
    return dispatch(clearHighlightReply);
}, Constants.PERMALINK_FADEOUT);

export function selectPostAndHighlight(post: Post): ActionFunc {
    return (dispatch) => {
        dispatch(batchActions([
            selectPost(post),
            highlightReply(post),
        ]));

        debouncedClearHighlightReply(dispatch);

        return {data: true};
    };
}

export function selectPostCard(post: Post) {
    return {type: ActionTypes.SELECT_POST_CARD, postId: post.id, channelId: post.channel_id};
}

export function openRHSSearch(): ActionFunc {
    return (dispatch) => {
        dispatch(clearSearch());
        dispatch(updateSearchTerms(''));
        dispatch(updateSearchResultsTerms(''));

        dispatch(updateRhsState(RHSStates.SEARCH));

        return {data: true};
    };
}

export function openAtPrevious(previous: any): ThunkActionFunc<unknown, GlobalState> {
    return (dispatch, getState) => {
        if (!previous) {
            return dispatch(openRHSSearch());
        }

        if (previous.isChannelInfo) {
            const currentChannelId = getCurrentChannelId(getState());
            return dispatch(showChannelInfo(currentChannelId));
        }
        if (previous.isChannelMembers) {
            const currentChannelId = getCurrentChannelId(getState());
            return dispatch(showChannelMembers(currentChannelId));
        }
        if (previous.isMentionSearch) {
            return dispatch(showMentions());
        }
        if (previous.isPinnedPosts) {
            return dispatch(showPinnedPosts());
        }
        if (previous.isFlaggedPosts) {
            return dispatch(showFlaggedPosts());
        }
        if (previous.selectedPostId) {
            const post = getPost(getState(), previous.selectedPostId);
            return post ? dispatch(selectPostFromRightHandSideSearchWithPreviousState(post, previous.previousRhsState)) : dispatch(openRHSSearch());
        }
        if (previous.selectedPostCardId) {
            const post = getPost(getState(), previous.selectedPostCardId);
            return post ? dispatch(selectPostCardFromRightHandSideSearchWithPreviousState(post, previous.previousRhsState)) : dispatch(openRHSSearch());
        }
        if (previous.searchVisible) {
            return dispatch(showSearchResults());
        }

        return dispatch(openRHSSearch());
    };
}

export const suppressRHS = {
    type: ActionTypes.SUPPRESS_RHS,
};

export const unsuppressRHS = {
    type: ActionTypes.UNSUPPRESS_RHS,
};

export function setEditChannelMembers(active: boolean) {
    return {
        type: ActionTypes.SET_EDIT_CHANNEL_MEMBERS,
        active,
    };
}
