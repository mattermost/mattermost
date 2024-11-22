// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {Channel} from '@mattermost/types/channels';

import {TeamTypes} from 'mattermost-redux/action_types';
import {
    leaveChannel as leaveChannelRedux,
    joinChannel,
    markChannelAsRead,
    unfavoriteChannel,
    deleteChannel as deleteChannelRedux,
    getChannel as loadChannel,
} from 'mattermost-redux/actions/channels';
import * as PostActions from 'mattermost-redux/actions/posts';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {autocompleteUsers} from 'mattermost-redux/actions/users';
import {Posts, RequestStatus} from 'mattermost-redux/constants';
import {
    getChannel,
    getChannelsNameMapInCurrentTeam,
    getCurrentChannel,
    getRedirectChannelNameForTeam,
    getMyChannels,
    getMyChannelMemberships,
    getAllDirectChannelsNameMapInCurrentTeam,
    isFavoriteChannel,
    isManuallyUnread,
    getCurrentChannelId,
} from 'mattermost-redux/selectors/entities/channels';
import {getMostRecentPostIdInChannel, getPost} from 'mattermost-redux/selectors/entities/posts';
import {
    getCurrentRelativeTeamUrl,
    getCurrentTeam,
    getCurrentTeamId,
    getRelativeTeamUrl,
    getTeamsList,
} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUserByUsername} from 'mattermost-redux/selectors/entities/users';
import {makeAddLastViewAtToProfiles} from 'mattermost-redux/selectors/entities/utils';
import {getChannelByName} from 'mattermost-redux/utils/channel_utils';
import EventEmitter from 'mattermost-redux/utils/event_emitter';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import {loadCustomStatusEmojisForPostList} from 'actions/emoji_actions';
import {closeRightHandSide} from 'actions/views/rhs';
import {markThreadAsRead} from 'actions/views/threads';
import {getLastViewedChannelName} from 'selectors/local_storage';
import {getSelectedPost, getSelectedPostId} from 'selectors/rhs';
import {getLastPostsApiTimeForChannel} from 'selectors/views/channel';
import {getSelectedThreadIdInCurrentTeam} from 'selectors/views/threads';
import {getSocketStatus} from 'selectors/views/websocket';
import LocalStorageStore from 'stores/local_storage_store';

import {getHistory} from 'utils/browser_history';
import {isArchivedChannel} from 'utils/channel_utils';
import {Constants, ActionTypes, EventTypes, PostRequestTypes} from 'utils/constants';

import type {ActionFuncAsync, ThunkActionFunc} from 'types/store';

export function goToLastViewedChannel(): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentChannel = getCurrentChannel(state);
        const channelsInTeam = getChannelsNameMapInCurrentTeam(state);
        const directChannel = getAllDirectChannelsNameMapInCurrentTeam(state);
        const channels = Object.assign({}, channelsInTeam, directChannel);

        let channelToSwitchTo = getChannelByName(channels, getLastViewedChannelName(state));

        if (currentChannel?.id === channelToSwitchTo!.id) {
            channelToSwitchTo = getChannelByName(channels, getRedirectChannelNameForTeam(state, getCurrentTeamId(state)));
        }

        return dispatch(switchToChannel(channelToSwitchTo!));
    };
}

export function switchToChannelById(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const channel = getChannel(state, channelId);
        if (channel) {
            return dispatch(switchToChannel(channel));
        }
        return {data: true};
    };
}

export function loadIfNecessaryAndSwitchToChannelById(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        let channel = getChannel(state, channelId);
        if (!channel) {
            const res = await dispatch(loadChannel(channelId));
            channel = res.data!;
        }
        return dispatch(switchToChannel(channel));
    };
}

export function switchToChannel(channel: Channel & {userId?: string}): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const selectedTeamId = channel.team_id;
        const teamUrl = selectedTeamId ? getRelativeTeamUrl(state, selectedTeamId) : getCurrentRelativeTeamUrl(state);

        if (channel.userId) {
            const username = channel.userId ? channel.name : channel.display_name;
            const user = getUserByUsername(state, username);
            if (!user) {
                return {error: true};
            }

            const direct = await dispatch(openDirectChannelToUserId(user.id));
            if (direct.error) {
                return {error: true};
            }
            getHistory().push(`${teamUrl}/messages/@${channel.name}`);
        } else if (channel.type === Constants.GM_CHANNEL) {
            const gmChannel = getChannel(state, channel.id);
            if (!gmChannel?.name) {
                return {error: true};
            }
            getHistory().push(`${teamUrl}/channels/${gmChannel.name}`);
        } else if (channel.type === Constants.THREADS) {
            getHistory().push(`${teamUrl}/${channel.name}`);
        } else {
            getHistory().push(`${teamUrl}/channels/${channel.name}`);
        }

        return {data: true};
    };
}

export function joinChannelById(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const currentTeamId = getCurrentTeamId(state);

        return dispatch(joinChannel(currentUserId, currentTeamId, channelId));
    };
}

export function leaveChannel(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let state = getState();
        const currentUserId = getCurrentUserId(state);
        const currentTeam = getCurrentTeam(state);
        if (!currentTeam) {
            return {data: false};
        }
        const channel = getChannel(state, channelId);
        const currentChannelId = getCurrentChannelId(state);

        if (isFavoriteChannel(state, channelId)) {
            dispatch(unfavoriteChannel(channelId));
        }

        const teamUrl = getCurrentRelativeTeamUrl(state);

        if (!isArchivedChannel(channel)) {
            LocalStorageStore.removePreviousChannel(currentUserId, currentTeam.id, state);
        }
        const {error} = await dispatch(leaveChannelRedux(channelId));
        if (error) {
            return {error};
        }
        state = getState();

        const prevChannelName = LocalStorageStore.getPreviousChannelName(currentUserId, currentTeam.id, state);
        const channelsInTeam = getChannelsNameMapInCurrentTeam(state);
        const prevChannel = getChannelByName(channelsInTeam, prevChannelName);
        if (!prevChannel || !getMyChannelMemberships(state)[prevChannel.id]) {
            LocalStorageStore.removePreviousChannel(currentUserId, currentTeam.id, state);
        }
        const selectedPost = getSelectedPost(state);
        const selectedPostId = getSelectedPostId(state);
        if (selectedPostId && selectedPost.exists === false) {
            dispatch(closeRightHandSide());
        }

        if (getMyChannels(getState()).filter((c) => c.type === Constants.OPEN_CHANNEL || c.type === Constants.PRIVATE_CHANNEL).length === 0) {
            LocalStorageStore.removePreviousChannel(currentUserId, currentTeam.id, state);
            dispatch(selectTeam(''));
            dispatch({type: TeamTypes.LEAVE_TEAM, data: currentTeam});
            getHistory().push('/');
        } else if (channelId === currentChannelId) {
            // We only need to leave the channel if we are in the channel
            getHistory().push(teamUrl);
        }

        return {
            data: true,
        };
    };
}

export function leaveDirectChannel(channelName: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const teams = getTeamsList(state); // dms are shared across teams but on local storage are set linked to one, we need to look into all.
        teams.forEach((currentTeam) => {
            const previousChannel = LocalStorageStore.getPreviousChannelName(currentUserId, currentTeam.id, state);
            const penultimateChannel = LocalStorageStore.getPenultimateChannelName(currentUserId, currentTeam.id, state);
            if (channelName === previousChannel) {
                LocalStorageStore.removePreviousChannel(currentUserId, currentTeam.id, state);
            } else if (channelName === penultimateChannel) {
                LocalStorageStore.removePenultimateChannelName(currentUserId, currentTeam.id);
            }
        });
        return {
            data: true,
        };
    };
}

export function autocompleteUsersInChannel(prefix: string, channelId: string): ActionFuncAsync<UserAutocomplete> {
    const addLastViewAtToProfiles = makeAddLastViewAtToProfiles();
    return async (dispatch, getState) => {
        const state = getState();
        const currentTeamId = getCurrentTeamId(state);

        const response = await dispatch(autocompleteUsers(prefix, currentTeamId, channelId));

        const data = response.data;
        if (data) {
            return {
                ...response,
                data: {
                    ...data,
                    users: addLastViewAtToProfiles(state, data.users || []),
                    out_of_channel: addLastViewAtToProfiles(state, data.out_of_channel || []),
                },
            };
        }

        return response;
    };
}

export function loadUnreads(channelId: string, prefetch = false): ActionFuncAsync<{atLatestMessage: boolean; atOldestMessage: boolean}> {
    return async (dispatch) => {
        const time = Date.now();
        if (prefetch) {
            dispatch({
                type: ActionTypes.PREFETCH_POSTS_FOR_CHANNEL,
                channelId,
                status: RequestStatus.STARTED,
            });
        }
        const {data, error} = await dispatch(PostActions.getPostsUnread(channelId));
        if (error) {
            if (prefetch) {
                dispatch({
                    type: ActionTypes.PREFETCH_POSTS_FOR_CHANNEL,
                    channelId,
                    status: RequestStatus.FAILURE,
                });
            }
            return {
                error,
                atLatestMessage: false,
                atOldestmessage: false,
            };
        }
        dispatch(loadCustomStatusEmojisForPostList(data!.posts));

        const actions = [];
        actions.push({
            type: ActionTypes.INCREASE_POST_VISIBILITY,
            data: channelId,
            amount: data!.order.length,
        });

        if (prefetch) {
            actions.push({
                type: ActionTypes.PREFETCH_POSTS_FOR_CHANNEL,
                channelId,
                status: RequestStatus.SUCCESS,
            });
        }

        if (data!.next_post_id === '') {
            actions.push({
                type: ActionTypes.RECEIVED_POSTS_FOR_CHANNEL_AT_TIME,
                channelId,
                time,
            });
        }

        dispatch(batchActions(actions));
        return {
            atLatestMessage: data!.next_post_id === '',
            atOldestmessage: data!.prev_post_id === '',
        };
    };
}

export function loadPostsAround(channelId: string, focusedPostId: string): ActionFuncAsync {
    return async (dispatch) => {
        const {data, error} = await dispatch(PostActions.getPostsAround(channelId, focusedPostId, Posts.POST_CHUNK_SIZE / 2));
        if (error) {
            return {
                error,
                atLatestMessage: false,
                atOldestmessage: false,
            };
        }

        dispatch({
            type: ActionTypes.INCREASE_POST_VISIBILITY,
            data: channelId,
            amount: data!.order.length,
        });
        return {
            atLatestMessage: data!.next_post_id === '',
            atOldestmessage: data!.prev_post_id === '',
        };
    };
}

export function loadLatestPosts(channelId: string): ActionFuncAsync {
    return async (dispatch) => {
        const time = Date.now();
        const {data, error} = await dispatch(PostActions.getPosts(channelId, 0, Posts.POST_CHUNK_SIZE / 2));

        if (error) {
            return {
                error,
                atLatestMessage: false,
                atOldestmessage: false,
            };
        }

        dispatch({
            type: ActionTypes.RECEIVED_POSTS_FOR_CHANNEL_AT_TIME,
            channelId,
            time,
        });

        return {
            data,
            atLatestMessage: data!.next_post_id === '',
            atOldestmessage: data!.prev_post_id === '',
        };
    };
}

export interface LoadPostsReturnValue {
    error?: string;
    moreToLoad: boolean;
}

export type CanLoadMorePosts = typeof PostRequestTypes[keyof typeof PostRequestTypes] | undefined

export interface LoadPostsParameters {
    channelId: string;
    postId: string;
    type: CanLoadMorePosts;
}

export function loadPosts({
    channelId,
    postId,
    type,
}: LoadPostsParameters): ThunkActionFunc<Promise<LoadPostsReturnValue>> {
    //type here can be BEFORE_ID or AFTER_ID
    return async (dispatch) => {
        const POST_INCREASE_AMOUNT = Constants.POST_CHUNK_SIZE / 2;

        dispatch({
            type: ActionTypes.LOADING_POSTS,
            data: true,
            channelId,
        });

        const page = 0;
        let result;
        if (type === PostRequestTypes.BEFORE_ID) {
            result = await dispatch(PostActions.getPostsBefore(channelId, postId, page, POST_INCREASE_AMOUNT));
        } else {
            result = await dispatch(PostActions.getPostsAfter(channelId, postId, page, POST_INCREASE_AMOUNT));
        }

        const {data} = result;

        const actions: AnyAction[] = [{
            type: ActionTypes.LOADING_POSTS,
            data: false,
            channelId,
        }];

        if (result.error) {
            return {
                error: result.error,
                moreToLoad: true,
            };
        }

        dispatch(loadCustomStatusEmojisForPostList(data!.posts));
        actions.push({
            type: ActionTypes.INCREASE_POST_VISIBILITY,
            data: channelId,
            amount: data!.order.length,
        });

        dispatch(batchActions(actions));

        return {
            moreToLoad: type === PostRequestTypes.BEFORE_ID ? data!.prev_post_id !== '' : data!.next_post_id !== '',
        };
    };
}

export function syncPostsInChannel(channelId: string, since: number, prefetch = false): ActionFuncAsync {
    return async (dispatch, getState) => {
        const time = Date.now();
        const state = getState();
        const socketStatus = getSocketStatus(state);
        let sinceTimeToGetPosts = since;
        const lastPostsApiCallForChannel = getLastPostsApiTimeForChannel(state, channelId);
        const actions = [];

        if (lastPostsApiCallForChannel && lastPostsApiCallForChannel < socketStatus.lastDisconnectAt) {
            sinceTimeToGetPosts = lastPostsApiCallForChannel;
        }

        if (prefetch) {
            dispatch({
                type: ActionTypes.PREFETCH_POSTS_FOR_CHANNEL,
                channelId,
                status: RequestStatus.STARTED,
            });
        }

        const {data, error} = await dispatch(PostActions.getPostsSince(channelId, sinceTimeToGetPosts));
        if (data) {
            actions.push({
                type: ActionTypes.RECEIVED_POSTS_FOR_CHANNEL_AT_TIME,
                channelId,
                time,
            });
        }

        if (prefetch) {
            if (error) {
                actions.push({
                    type: ActionTypes.PREFETCH_POSTS_FOR_CHANNEL,
                    channelId,
                    status: RequestStatus.FAILURE,
                });
            } else {
                actions.push({
                    type: ActionTypes.PREFETCH_POSTS_FOR_CHANNEL,
                    channelId,
                    status: RequestStatus.SUCCESS,
                });
            }
        }

        dispatch(batchActions(actions));

        return {data, error};
    };
}

export function prefetchChannelPosts(channelId: string, jitter?: number): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const recentPostIdInChannel = getMostRecentPostIdInChannel(state, channelId);

        if (!state.entities.posts.postsInChannel[channelId] || !recentPostIdInChannel) {
            if (jitter) {
                await new Promise((resolve) => setTimeout(resolve, jitter));
            }
            return dispatch(loadUnreads(channelId, true));
        }

        const recentPost = getPost(state, recentPostIdInChannel);
        return dispatch(syncPostsInChannel(channelId, recentPost.create_at, true));
    };
}

export function scrollPostListToBottom() {
    return () => {
        EventEmitter.emit(EventTypes.POST_LIST_SCROLL_TO_BOTTOM);
    };
}

export function markAsReadOnFocus(): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        const state = getState();
        const currentChannelId = getCurrentChannelId(state);
        const selectedThreadId = getSelectedThreadIdInCurrentTeam(state);
        const selectedPostId = getSelectedPostId(state);

        if (!isManuallyUnread(getState(), currentChannelId)) {
            dispatch(markChannelAsRead(currentChannelId));
        }

        if (selectedThreadId) {
            dispatch(markThreadAsRead(selectedThreadId));
        }

        if (currentChannelId && selectedPostId) {
            dispatch(markThreadAsRead(selectedPostId));
        }
    };
}

export function updateToastStatus(status: boolean) {
    return {
        type: ActionTypes.UPDATE_TOAST_STATUS,
        data: status,
    };
}

export function deleteChannel(channelId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const res = await dispatch(deleteChannelRedux(channelId));
        if (res.error) {
            return {data: false};
        }
        const state = getState();

        const selectedPost = getSelectedPost(state);
        const selectedPostId = getSelectedPostId(state);
        if (selectedPostId && !selectedPost.exists) {
            dispatch(closeRightHandSide());
        }

        return {data: true};
    };
}
