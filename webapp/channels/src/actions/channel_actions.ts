// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {Channel, ChannelMembership, ServerChannel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {Role} from '@mattermost/types/roles';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {ChannelTypes, PreferenceTypes, RoleTypes} from 'mattermost-redux/action_types';
import * as ChannelActions from 'mattermost-redux/actions/channels';
import {logError} from 'mattermost-redux/actions/errors';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Client4} from 'mattermost-redux/client';
import {getChannelByName, getUnreadChannelIds, getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamUrl, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {
    getChannelsAndChannelMembersQueryString,
    transformToReceivedChannelsReducerPayload,
    transformToReceivedChannelMembersReducerPayload,
    CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE,
} from 'actions/channel_queries';
import type {
    ChannelsAndChannelMembersQueryResponseType,
    GraphQLChannel,
    GraphQLChannelMember} from 'actions/channel_queries';
import {trackEvent} from 'actions/telemetry_actions.jsx';
import {loadNewDMIfNeeded, loadNewGMIfNeeded, loadProfilesForSidebar} from 'actions/user_actions';

import {getHistory} from 'utils/browser_history';
import {Constants, Preferences, NotificationLevels} from 'utils/constants';
import {getDirectChannelName} from 'utils/utils';

export function openDirectChannelToUserId(userId: UserProfile['id']): ActionFunc {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const channelName = getDirectChannelName(currentUserId, userId);
        const channel = getChannelByName(state, channelName);

        if (!channel) {
            return dispatch(ChannelActions.createDirectChannel(currentUserId, userId));
        }

        trackEvent('api', 'api_channels_join_direct');
        const now = Date.now();
        const prefDirect = {
            category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
            name: userId,
            value: 'true',
        };
        const prefOpenTime = {
            category: Preferences.CATEGORY_CHANNEL_OPEN_TIME,
            name: channel.id,
            value: now.toString(),
        };
        const actions = [{
            type: PreferenceTypes.RECEIVED_PREFERENCES,
            data: [prefDirect],
        }, {
            type: PreferenceTypes.RECEIVED_PREFERENCES,
            data: [prefOpenTime],
        }];
        dispatch(batchActions(actions));

        dispatch(savePreferences(currentUserId, [
            {user_id: currentUserId, ...prefDirect},
            {user_id: currentUserId, ...prefOpenTime},
        ]));

        return {data: channel};
    };
}

export function openGroupChannelToUserIds(userIds: Array<UserProfile['id']>): ActionFunc {
    return async (dispatch, getState) => {
        const result = await dispatch(ChannelActions.createGroupChannel(userIds));

        if (result.error) {
            getHistory().push(getCurrentTeamUrl(getState()));
        }

        return result;
    };
}

export function loadChannelsForCurrentUser(): ActionFunc {
    return async (dispatch, getState) => {
        const state = getState();
        const unreads = getUnreadChannelIds(state);

        await dispatch(ChannelActions.fetchMyChannelsAndMembersREST(getCurrentTeamId(state)));
        for (const id of unreads) {
            const channel = getChannel(state, id);
            if (channel && channel.type === Constants.DM_CHANNEL) {
                dispatch(loadNewDMIfNeeded(channel.id));
            } else if (channel && channel.type === Constants.GM_CHANNEL) {
                dispatch(loadNewGMIfNeeded(channel.id));
            }
        }

        loadProfilesForSidebar();
        return {data: true};
    };
}

export function searchMoreChannels(term: string, showArchivedChannels: boolean, hideJoinedChannels: boolean): ActionFunc<Channel[], ServerError> {
    return async (dispatch, getState) => {
        const state = getState();
        const teamId = getCurrentTeamId(state);

        if (!teamId) {
            throw new Error('No team id');
        }

        const {data, error} = await dispatch(ChannelActions.searchChannels(teamId, term, showArchivedChannels));
        if (data) {
            const myMembers = getMyChannelMemberships(state);
            const channels = hideJoinedChannels ? (data as Channel[]).filter((channel) => !myMembers[channel.id]) : data;
            return {data: channels};
        }

        return {error};
    };
}

export function autocompleteChannels(term: string, success: (channels: Channel[]) => void, error?: (err: ServerError) => void): ActionFunc {
    return async (dispatch, getState) => {
        const state = getState();
        const teamId = getCurrentTeamId(state);
        if (!teamId) {
            return {data: false};
        }

        const {data, error: err} = await dispatch(ChannelActions.autocompleteChannels(teamId, term));
        if (data && success) {
            success(data);
        } else if (err && error) {
            error({id: err.server_error_id, ...err});
        }

        return {data: true};
    };
}

export function autocompleteChannelsForSearch(term: string, success: (channels: Channel[]) => void, error: (err: ServerError) => void): ActionFunc {
    return async (dispatch, getState) => {
        const state = getState();
        const teamId = getCurrentTeamId(state);

        if (!teamId) {
            return {data: false};
        }

        const {data, error: err} = await dispatch(ChannelActions.autocompleteChannelsForSearch(teamId, term));
        if (data && success) {
            success(data);
        } else if (err && error) {
            error({id: err.server_error_id, ...err});
        }
        return {data: true};
    };
}

export function addUsersToChannel(channelId: Channel['id'], userIds: Array<UserProfile['id']>): ActionFunc {
    return async (dispatch) => {
        try {
            const requests = userIds.map((uId) => dispatch(ChannelActions.addChannelMember(channelId, uId)));

            return await Promise.all(requests);
        } catch (error) {
            return {error};
        }
    };
}

export function unmuteChannel(userId: UserProfile['id'], channelId: Channel['id']) {
    return ChannelActions.updateChannelNotifyProps(userId, channelId, {
        mark_unread: NotificationLevels.ALL,
    });
}

export function muteChannel(userId: UserProfile['id'], channelId: Channel['id']) {
    return ChannelActions.updateChannelNotifyProps(userId, channelId, {
        mark_unread: NotificationLevels.MENTION,
    });
}

/**
 * Fetches channels and channel members with graphql and then dispatches the result to redux store.
 * @param teamId If team id is provided, only channels and channel members in that team will be fetched. Otherwise, all channels and all channel members will be fetched.
 */
export function fetchChannelsAndMembers(teamId: Team['id'] = ''): ActionFunc<{channels: ServerChannel[]; channelMembers: ChannelMembership[]}> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        let channelsResponse: GraphQLChannel[] = [];
        let channelMembersResponse: GraphQLChannelMember[] = [];

        try {
            let channelsCursor = '';
            let channelMembersCursor = '';
            let page = 1;
            let responsesPerPage: number;

            do {
                // eslint-disable-next-line no-await-in-loop
                const {data, errors} = await Client4.fetchWithGraphQL<ChannelsAndChannelMembersQueryResponseType>(getChannelsAndChannelMembersQueryString(teamId, channelsCursor, channelMembersCursor));

                if (errors || !data) {
                    throw new Error(`Failed to fetch channels and channel members at page ${page}`);
                } else if (data.channels.length === 0 || data.channelMembers.length === 0) {
                    break;
                }

                // Based on the fact that the number of channels and channel members returned by the server is the same
                responsesPerPage = data.channels.length;
                channelsCursor = data.channels[responsesPerPage - 1].cursor;
                channelMembersCursor = data.channelMembers[responsesPerPage - 1].cursor;
                page += 1;

                channelsResponse = [...channelsResponse, ...data.channels];
                channelMembersResponse = [...channelMembersResponse, ...data.channelMembers];
            } while (responsesPerPage === CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE);
        } catch (error) {
            dispatch(logError(error as ServerError));
            return {error: error as ServerError};
        }

        let roles: Role[] = [];
        channelMembersResponse.forEach((channelMembers) => {
            if (channelMembers?.roles?.length) {
                channelMembers.roles.forEach((role) => {
                    roles = [...roles, role];
                });
            }
        });

        const channels = transformToReceivedChannelsReducerPayload(channelsResponse);
        const channelMembers = transformToReceivedChannelMembersReducerPayload(channelMembersResponse, currentUserId);

        const actions = [];
        if (teamId) {
            actions.push({
                type: ChannelTypes.RECEIVED_CHANNELS,
                teamId,
                data: channels,
            });
            actions.push({
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                data: channelMembers,
            });
            actions.push({
                type: RoleTypes.RECEIVED_ROLES,
                data: roles,
            });
        } else {
            actions.push({
                type: ChannelTypes.RECEIVED_ALL_CHANNELS,
                data: channels,
            });
            actions.push({
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                data: channelMembers,
            });
        }

        await dispatch(batchActions(actions));

        return {data: {channels, channelMembers, roles}};
    };
}
