// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import {SearchTypes} from 'mattermost-redux/action_types';
import {
    clearSearch,
    getFlaggedPosts,
    getPinnedPosts,
    searchPostsWithParams,
    searchFilesWithParams,
} from 'mattermost-redux/actions/search';
import * as PostActions from 'mattermost-redux/actions/posts';
import {getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentChannelId, getCurrentChannelNameForSearchShortcut, getChannel as getChannelSelector} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {Action, ActionResult, DispatchFunc, GenericAction, GetStateFunc} from 'mattermost-redux/types/actions';
import {Post} from '@mattermost/types/posts';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getSearchTerms, getRhsState, getPluggableId, getFilesSearchExtFilter, getPreviousRhsState} from 'selectors/rhs';
import {ActionTypes, RHSStates, Constants} from 'utils/constants';
import * as Utils from 'utils/utils';
import {getBrowserUtcOffset, getUtcOffsetForTimeZone} from 'utils/timezone';
import {RhsState} from 'types/store/rhs';
import {GlobalState} from 'types/store';
import {getPostsByIds, getPost as fetchPost} from 'mattermost-redux/actions/posts';

import {getChannel} from 'mattermost-redux/actions/channels';

function selectPostFromRightHandSideSearchWithPreviousState(post: Post, previousRhsState?: RhsState) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const postRootId = Utils.getRootId(post);
        await dispatch(PostActions.getPostThread(postRootId));
        const state = getState() as GlobalState;

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

function selectPostCardFromRightHandSideSearchWithPreviousState(post: Post, previousRhsState?: RhsState) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;

        dispatch({
            type: ActionTypes.SELECT_POST_CARD,
            postId: post.id,
            channelId: post.channel_id,
            previousRhsState: previousRhsState || getRhsState(state),
        });

        return {data: true};
    };
}

export function updateRhsState(rhsState: string, channelId?: string, previousRhsState?: RhsState) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const action = {
            type: ActionTypes.UPDATE_RHS_STATE,
            state: rhsState,
        } as GenericAction;

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

export function goBack() {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const prevState = getPreviousRhsState(getState() as GlobalState);
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

export function selectPostCardFromRightHandSideSearch(post: Post) {
    return selectPostCardFromRightHandSideSearchWithPreviousState(post);
}

export function selectPostFromRightHandSideSearchByPostId(postId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const post = getPost(getState(), postId);
        return selectPostFromRightHandSideSearch(post)(dispatch, getState);
    };
}

export function updateSearchTerms(terms: string) {
    return {
        type: ActionTypes.UPDATE_RHS_SEARCH_TERMS,
        terms,
    };
}

export function updateSearchTermsForShortcut() {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function performSearch(terms: string, isMentionSearch?: boolean) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const teamId = getCurrentTeamId(getState());
        const config = getConfig(getState());
        const viewArchivedChannels = config.ExperimentalViewArchivedChannels === 'true';
        const extensionsFilters = getFilesSearchExtFilter(getState() as GlobalState);

        const extensions = extensionsFilters?.map((ext) => `ext:${ext}`).join(' ');
        let termsWithExtensionsFilters = terms;
        if (extensions?.trim().length > 0) {
            termsWithExtensionsFilters += ` ${extensions}`;
        }

        // timezone offset in seconds
        const userCurrentTimezone = getCurrentTimezone(getState());
        const timezoneOffset = ((userCurrentTimezone && (userCurrentTimezone.length > 0)) ? getUtcOffsetForTimeZone(userCurrentTimezone) : getBrowserUtcOffset()) * 60;
        const messagesPromise = dispatch(searchPostsWithParams(isMentionSearch ? '' : teamId, {terms, is_or_search: Boolean(isMentionSearch), include_deleted_channels: viewArchivedChannels, time_zone_offset: timezoneOffset, page: 0, per_page: 20}));
        const filesPromise = dispatch(searchFilesWithParams(teamId, {terms: termsWithExtensionsFilters, is_or_search: Boolean(isMentionSearch), include_deleted_channels: viewArchivedChannels, time_zone_offset: timezoneOffset, page: 0, per_page: 20}));
        return Promise.all([filesPromise, messagesPromise]);
    };
}

export function filterFilesSearchByExt(extensions: string[]) {
    return (dispatch: DispatchFunc) => {
        dispatch({
            type: ActionTypes.SET_FILES_FILTER_BY_EXT,
            data: extensions,
        });
        return {data: true};
    };
}

export function showSearchResults(isMentionSearch = false) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;

        const searchTerms = getSearchTerms(state);

        if (isMentionSearch) {
            dispatch(updateRhsState(RHSStates.MENTION));
        } else {
            dispatch(updateRhsState(RHSStates.SEARCH));
        }
        dispatch(updateSearchResultsTerms(searchTerms));

        const terms = searchTerms.trim().startsWith('@') ? searchTerms.replace('@', 'from:') : searchTerms;

        return dispatch(performSearch(terms));
    };
}

export function showRHSPlugin(pluggableId: string) {
    return {
        type: ActionTypes.UPDATE_RHS_STATE,
        state: RHSStates.PLUGIN,
        pluggableId,
    };
}

export function showChannelMembers(channelId: string, inEditingMode = false) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;

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

export function hideRHSPlugin(pluggableId: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;

        if (getPluggableId(state) === pluggableId) {
            dispatch(closeRightHandSide());
        }

        return {data: true};
    };
}

export function toggleRHSPlugin(pluggableId: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;

        if (getPluggableId(state) === pluggableId) {
            dispatch(hideRHSPlugin(pluggableId));
            return {data: false};
        }

        dispatch(showRHSPlugin(pluggableId));
        return {data: true};
    };
}

export function showFlaggedPosts() {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const teamId = getCurrentTeamId(state);

        dispatch({
            type: ActionTypes.UPDATE_RHS_STATE,
            state: RHSStates.FLAG,
        });

        const results = await dispatch(getFlaggedPosts());
        let data: any;
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

export function showPinnedPosts(channelId?: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
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

        let data: any;
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

export function showChannelFiles(channelId: string) {
    return async (dispatch: (action: Action, getState?: GetStateFunc | null) => Promise<ActionResult|[ActionResult, ActionResult]>, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
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

export function showMentions() {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
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
    return (dispatch: DispatchFunc) => {
        dispatch({
            type: ActionTypes.UPDATE_RHS_STATE,
            channelId,
            state: RHSStates.CHANNEL_INFO,
        });
        return {data: true};
    };
}

export function closeRightHandSide() {
    return (dispatch: DispatchFunc) => {
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

export const toggleMenu = () => (dispatch: DispatchFunc) => dispatch({
    type: ActionTypes.TOGGLE_RHS_MENU,
});

export const openMenu = () => (dispatch: DispatchFunc) => dispatch({
    type: ActionTypes.OPEN_RHS_MENU,
});

export const closeMenu = () => (dispatch: DispatchFunc) => dispatch({
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

export function selectPostAndParentChannel(post: Post) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const channel = getChannelSelector(getState(), post.channel_id);
        if (!channel) {
            await dispatch(getChannel(post.channel_id));
        }
        return dispatch(selectPost(post));
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

export function selectPostById(postId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function selectPostAndHighlight(post: Post) {
    return (dispatch: DispatchFunc) => {
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

export function openRHSSearch() {
    return (dispatch: DispatchFunc) => {
        dispatch(clearSearch());
        dispatch(updateSearchTerms(''));
        dispatch(updateSearchResultsTerms(''));

        dispatch(updateRhsState(RHSStates.SEARCH));

        return {data: true};
    };
}

export function openAtPrevious(previous: any) { // TODO Could not find the proper type. Seems to be in several props around
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        if (!previous) {
            return openRHSSearch()(dispatch);
        }

        if (previous.isChannelInfo) {
            const currentChannelId = getCurrentChannelId(getState());
            return showChannelInfo(currentChannelId)(dispatch);
        }
        if (previous.isChannelMembers) {
            const currentChannelId = getCurrentChannelId(getState());
            return showChannelMembers(currentChannelId)(dispatch, getState);
        }
        if (previous.isMentionSearch) {
            return showMentions()(dispatch, getState);
        }
        if (previous.isPinnedPosts) {
            return showPinnedPosts()(dispatch, getState);
        }
        if (previous.isFlaggedPosts) {
            return showFlaggedPosts()(dispatch, getState);
        }
        if (previous.selectedPostId) {
            const post = getPost(getState(), previous.selectedPostId);
            return post ? selectPostFromRightHandSideSearchWithPreviousState(post, previous.previousRhsState)(dispatch, getState) : openRHSSearch()(dispatch);
        }
        if (previous.selectedPostCardId) {
            const post = getPost(getState(), previous.selectedPostCardId);
            return post ? selectPostCardFromRightHandSideSearchWithPreviousState(post, previous.previousRhsState)(dispatch, getState) : openRHSSearch()(dispatch);
        }
        if (previous.searchVisible) {
            return showSearchResults()(dispatch, getState);
        }

        return openRHSSearch()(dispatch);
    };
}

export const suppressRHS = {
    type: ActionTypes.SUPPRESS_RHS,
};

export const unsuppressRHS = {
    type: ActionTypes.UNSUPPRESS_RHS,
};

export function setEditChannelMembers(active: boolean) {
    return (dispatch: DispatchFunc) => {
        dispatch({
            type: ActionTypes.SET_EDIT_CHANNEL_MEMBERS,
            active,
        });
        return {data: true};
    };
}
