// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {
    Channel,
    ChannelNotifyProps,
    ChannelMembership,
    ChannelModerationPatch,
    ChannelsWithTotalCount,
    ChannelSearchOpts,
    ServerChannel,
    ChannelStats,
    ChannelWithTeamData,
} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {PreferenceType} from '@mattermost/types/preferences';

import {ChannelTypes, PreferenceTypes, UserTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {MarkUnread} from 'mattermost-redux/constants/channels';
import {getCategoryInTeamByType} from 'mattermost-redux/selectors/entities/channel_categories';
import {
    getChannel as getChannelSelector,
    getChannelsNameMapInTeam,
    getMyChannelMember as getMyChannelMemberSelector,
    getRedirectChannelNameForTeam,
    isManuallyUnread,
} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import type {GetStateFunc, ActionFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';
import {getChannelByName} from 'mattermost-redux/utils/channel_utils';

import {addChannelToInitialCategory, addChannelToCategory} from './channel_categories';
import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';
import {savePreferences} from './preferences';
import {loadRolesIfNeeded} from './roles';
import {getMissingProfilesByIds} from './users';

import {General, Preferences} from '../constants';

export function selectChannel(channelId: string) {
    return {
        type: ChannelTypes.SELECT_CHANNEL,
        data: channelId,
    };
}

export function createChannel(channel: Channel, userId: string): ActionFuncAsync<Channel> {
    return async (dispatch, getState) => {
        let created;
        try {
            created = await Client4.createChannel(channel);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({
                type: ChannelTypes.CREATE_CHANNEL_FAILURE,
                error,
            });
            dispatch(logError(error));
            return {error};
        }

        const member = {
            channel_id: created.id,
            user_id: userId,
            roles: `${General.CHANNEL_USER_ROLE} ${General.CHANNEL_ADMIN_ROLE}`,
            last_viewed_at: 0,
            msg_count: 0,
            mention_count: 0,
            notify_props: {desktop: 'default', mark_unread: 'all'},
            last_update_at: created.create_at,
        };

        const actions: AnyAction[] = [];
        const {channels, myMembers} = getState().entities.channels;

        if (!channels[created.id]) {
            actions.push({type: ChannelTypes.RECEIVED_CHANNEL, data: created});
        }

        if (!myMembers[created.id]) {
            actions.push({type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER, data: member});
            dispatch(loadRolesIfNeeded(member.roles.split(' ')));
        }

        dispatch(batchActions([
            ...actions,
            {
                type: ChannelTypes.CREATE_CHANNEL_SUCCESS,
            },
        ]));

        dispatch(addChannelToInitialCategory(created, true));

        return {data: created};
    };
}

export function createDirectChannel(userId: string, otherUserId: string): ActionFuncAsync<Channel> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.CREATE_CHANNEL_REQUEST, data: null});

        let created;
        try {
            created = await Client4.createDirectChannel([userId, otherUserId]);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.CREATE_CHANNEL_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        const member = {
            channel_id: created.id,
            user_id: userId,
            roles: `${General.CHANNEL_USER_ROLE}`,
            last_viewed_at: 0,
            msg_count: 0,
            mention_count: 0,
            notify_props: {desktop: 'default', mark_unread: 'all'},
            last_update_at: created.create_at,
        };

        const preferences = [
            {user_id: userId, category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: otherUserId, value: 'true'},
            {user_id: userId, category: Preferences.CATEGORY_CHANNEL_OPEN_TIME, name: created.id, value: new Date().getTime().toString()},
        ];

        dispatch(savePreferences(userId, preferences));

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: created,
            },
            {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: member,
            },
            {
                type: PreferenceTypes.RECEIVED_PREFERENCES,
                data: preferences,
            },
            {
                type: ChannelTypes.CREATE_CHANNEL_SUCCESS,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL,
                id: created.id,
                data: [{id: userId}, {id: otherUserId}],
            },
        ]));

        dispatch(addChannelToInitialCategory(created));

        dispatch(loadRolesIfNeeded(member.roles.split(' ')));

        return {data: created};
    };
}

export function markGroupChannelOpen(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const {currentUserId} = getState().entities.users;

        const preferences: PreferenceType[] = [
            {user_id: currentUserId, category: Preferences.CATEGORY_GROUP_CHANNEL_SHOW, name: channelId, value: 'true'},
            {user_id: currentUserId, category: Preferences.CATEGORY_CHANNEL_OPEN_TIME, name: channelId, value: new Date().getTime().toString()},
        ];

        return dispatch(savePreferences(currentUserId, preferences));
    };
}

export function createGroupChannel(userIds: string[]): ActionFuncAsync<Channel> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.CREATE_CHANNEL_REQUEST, data: null});

        const {currentUserId} = getState().entities.users;

        let created;
        try {
            created = await Client4.createGroupChannel(userIds);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.CREATE_CHANNEL_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        let member: Partial<ChannelMembership> | undefined = {
            channel_id: created.id,
            user_id: currentUserId,
            roles: `${General.CHANNEL_USER_ROLE}`,
            last_viewed_at: 0,
            msg_count: 0,
            mention_count: 0,
            msg_count_root: 0,
            mention_count_root: 0,
            notify_props: {desktop: 'default', mark_unread: 'all'},
            last_update_at: created.create_at,
        };

        // Check the channel previous existency: if the channel already have
        // posts is because it existed before.
        if (created.total_msg_count > 0) {
            const storeMember = getMyChannelMemberSelector(getState(), created.id);
            if (storeMember === null) {
                try {
                    member = await Client4.getMyChannelMember(created.id);
                } catch (error) {
                    // Log the error and keep going with the generated membership.
                    dispatch(logError(error));
                }
            } else {
                member = storeMember;
            }
        }

        dispatch(markGroupChannelOpen(created.id));

        const profilesInChannel = userIds.map((id) => ({id}));
        profilesInChannel.push({id: currentUserId}); // currentUserId is optionally in userIds, but the reducer will get rid of a duplicate

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: created,
            },
            {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: member,
            },
            {
                type: ChannelTypes.CREATE_CHANNEL_SUCCESS,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL,
                id: created.id,
                data: profilesInChannel,
            },
        ]));

        dispatch(addChannelToInitialCategory(created));

        dispatch(loadRolesIfNeeded((member && member.roles && member.roles.split(' ')) || []));

        return {data: created};
    };
}

export function patchChannel(channelId: string, patch: Partial<Channel>): ActionFuncAsync<Channel> {
    return bindClientFunc({
        clientFunc: Client4.patchChannel,
        onSuccess: [ChannelTypes.RECEIVED_CHANNEL],
        params: [channelId, patch],
    });
}

export function updateChannelPrivacy(channelId: string, privacy: string): ActionFuncAsync<Channel> {
    return bindClientFunc({
        clientFunc: Client4.updateChannelPrivacy,
        onSuccess: [ChannelTypes.RECEIVED_CHANNEL],
        params: [channelId, privacy],
    });
}

export function convertGroupMessageToPrivateChannel(channelID: string, teamID: string, displayName: string, name: string): ActionFuncAsync<Channel> {
    return async (dispatch, getState) => {
        let response;
        try {
            response = await Client4.convertGroupMessageToPrivateChannel(channelID, teamID, displayName, name);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL,
            data: response.data,
        });

        // move the channel from direct message category to the default "channels" category
        const channelsCategory = getCategoryInTeamByType(getState(), teamID, CategoryTypes.CHANNELS);
        if (!channelsCategory) {
            return {};
        }

        return {
            data: response.data,
        };
    };
}

export function updateChannelNotifyProps(userId: string, channelId: string, props: Partial<ChannelNotifyProps>): ActionFuncAsync {
    return async (dispatch, getState) => {
        const notifyProps = {
            user_id: userId,
            channel_id: channelId,
            ...props,
        };

        try {
            await Client4.updateChannelNotifyProps(notifyProps);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));

            return {error};
        }

        const member = getState().entities.channels.myMembers[channelId] || {};
        const currentNotifyProps = member.notify_props || {};

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL_PROPS,
            data: {
                channel_id: channelId,
                notifyProps: {...currentNotifyProps, ...notifyProps},
            },
        });

        return {data: true};
    };
}

export function getChannelByNameAndTeamName(teamName: string, channelName: string, includeDeleted = false): ActionFuncAsync<Channel> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getChannelByNameAndTeamName(teamName, channelName, includeDeleted);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL,
            data,
        });

        return {data};
    };
}

export function getChannel(channelId: string): ActionFuncAsync<Channel> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getChannel(channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL,
            data,
        });

        return {data};
    };
}

export function getChannelAndMyMember(channelId: string): ActionFuncAsync<{channel: Channel; member: ChannelMembership}> {
    return async (dispatch, getState) => {
        let channel;
        let member;
        try {
            const channelRequest = Client4.getChannel(channelId);
            const memberRequest = Client4.getMyChannelMember(channelId);

            channel = await channelRequest;
            member = await memberRequest;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: channel,
            },
            {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: member,
            },
        ]));
        dispatch(loadRolesIfNeeded(member.roles.split(' ')));

        return {data: {channel, member}};
    };
}

export function getChannelTimezones(channelId: string): ActionFuncAsync<string[]> {
    return async (dispatch, getState) => {
        let channelTimezones;
        try {
            const channelTimezonesRequest = Client4.getChannelTimezones(channelId);

            channelTimezones = await channelTimezonesRequest;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: channelTimezones};
    };
}

export function fetchChannelsAndMembers(teamId: string): ActionFuncAsync<{channels: ServerChannel[]; channelMembers: ChannelMembership[]}> {
    return async (dispatch, getState) => {
        let channels;
        let channelMembers;
        try {
            [channels, channelMembers] = await Promise.all([
                Client4.getMyChannels(teamId),
                Client4.getMyChannelMembers(teamId),
            ]);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error: error as ServerError};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNELS,
                teamId,
                data: channels,
            },
            {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                data: channelMembers,
            },
        ]));

        const roles = new Set<string>();
        for (const member of channelMembers) {
            for (const role of member.roles.split(' ')) {
                roles.add(role);
            }
        }
        if (roles.size > 0) {
            dispatch(loadRolesIfNeeded(roles));
        }

        return {data: {channels, channelMembers}};
    };
}

export function fetchAllMyTeamsChannelsAndChannelMembersREST(): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {currentUserId} = state.entities.users;
        let channels;
        let channelsMembers: ChannelMembership[] = [];
        let allMembers = true;
        let page = 0;
        do {
            try {
                // eslint-disable-next-line no-await-in-loop
                await Client4.getAllChannelsMembers(currentUserId, page, 200).then(
                    // eslint-disable-next-line no-loop-func
                    (data) => {
                        channelsMembers = [...channelsMembers, ...data];
                        page++;
                        if (data.length < 200) {
                            allMembers = false;
                        }
                    });
            } catch (error) {
                forceLogoutIfNecessary(error, dispatch, getState);
                dispatch(logError(error));
                return {error};
            }
        } while (allMembers && page <= 2);
        try {
            channels = await Client4.getAllTeamsChannels();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_ALL_CHANNELS,
                data: channels,
            },
            {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                data: channelsMembers,
                currentUserId,
            },
        ]));
        return {data: {channels, channelsMembers}};
    };
}

export function getChannelMembers(channelId: string, page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE): ActionFuncAsync<ChannelMembership[]> {
    return async (dispatch, getState) => {
        let channelMembers: ChannelMembership[];

        try {
            const channelMembersRequest = Client4.getChannelMembers(channelId, page, perPage);

            channelMembers = await channelMembersRequest;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const userIds = channelMembers.map((cm) => cm.user_id);
        dispatch(getMissingProfilesByIds(userIds));

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL_MEMBERS,
            data: channelMembers,
        });

        return {data: channelMembers};
    };
}

export function leaveChannel(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {currentUserId} = state.entities.users;
        const {channels, myMembers} = state.entities.channels;
        const channel = channels[channelId];
        const member = myMembers[channelId];

        Client4.trackEvent('action', 'action_channels_leave', {channel_id: channelId});

        dispatch({
            type: ChannelTypes.LEAVE_CHANNEL,
            data: {
                id: channelId,
                user_id: currentUserId,
                team_id: channel.team_id,
                type: channel.type,
            },
        });

        (async function removeFromChannelWrapper() {
            try {
                await Client4.removeFromChannel(currentUserId, channelId);
            } catch {
                dispatch(batchActions([
                    {
                        type: ChannelTypes.RECEIVED_CHANNEL,
                        data: channel,
                    },
                    {
                        type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                        data: member,
                    },
                ]));

                // The category here may not be the one in which the channel was originally located,
                // much less the order in which it was placed. Treating this as a transient issue
                // for the user to resolve by refreshing or leaving again.
                dispatch(addChannelToInitialCategory(channel, false));
            }
        }());

        return {data: true};
    };
}

export function joinChannel(userId: string, teamId: string, channelId: string, channelName?: string): ActionFuncAsync<{channel: Channel; member: ChannelMembership} | null> {
    return async (dispatch, getState) => {
        if (!channelId && !channelName) {
            return {data: null};
        }

        let member: ChannelMembership | undefined | null;
        let channel: Channel;
        try {
            if (channelId) {
                member = await Client4.addToChannel(userId, channelId);
                channel = await Client4.getChannel(channelId);
            } else {
                channel = await Client4.getChannelByName(teamId, channelName!, true);
                if ((channel.type === General.GM_CHANNEL) || (channel.type === General.DM_CHANNEL)) {
                    member = await Client4.getChannelMember(channel.id, userId);
                } else {
                    member = await Client4.addToChannel(userId, channel.id);
                }
            }
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        Client4.trackEvent('action', 'action_channels_join', {channel_id: channelId});

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: channel,
            },
            {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: member,
            },
        ]));

        dispatch(addChannelToInitialCategory(channel));

        if (member) {
            dispatch(loadRolesIfNeeded(member.roles.split(' ')));
        }

        return {data: {channel, member}};
    };
}

export function deleteChannel(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let state = getState();
        const viewArchivedChannels = state.entities.general.config.ExperimentalViewArchivedChannels === 'true';

        try {
            await Client4.deleteChannel(channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        state = getState();
        const {currentChannelId} = state.entities.channels;
        if (channelId === currentChannelId && !viewArchivedChannels) {
            const teamId = getCurrentTeamId(state);
            const channelsInTeam = getChannelsNameMapInTeam(state, teamId);
            const channel = getChannelByName(channelsInTeam, getRedirectChannelNameForTeam(state, teamId));
            if (channel && channel.id) {
                dispatch({type: ChannelTypes.SELECT_CHANNEL, data: channel.id});
            }
        }

        dispatch({type: ChannelTypes.DELETE_CHANNEL_SUCCESS, data: {id: channelId, viewArchivedChannels}});

        return {data: true};
    };
}

export function unarchiveChannel(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.unarchiveChannel(channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const state = getState();
        const config = getConfig(state);
        const viewArchivedChannels = config.ExperimentalViewArchivedChannels === 'true';
        dispatch({type: ChannelTypes.UNARCHIVED_CHANNEL_SUCCESS, data: {id: channelId, viewArchivedChannels}});

        return {data: true};
    };
}

export function updateApproximateViewTime(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const {currentUserId} = getState().entities.users;

        const {myPreferences} = getState().entities.preferences;

        const viewTimePref = myPreferences[`${Preferences.CATEGORY_CHANNEL_APPROXIMATE_VIEW_TIME}--${channelId}`];
        const viewTime = viewTimePref ? parseInt(viewTimePref.value!, 10) : 0;
        if (viewTime < new Date().getTime() - (3 * 60 * 60 * 1000)) {
            const preferences = [
                {user_id: currentUserId, category: Preferences.CATEGORY_CHANNEL_APPROXIMATE_VIEW_TIME, name: channelId, value: new Date().getTime().toString()},
            ];
            dispatch(savePreferences(currentUserId, preferences));
        }
        return {data: true};
    };
}

export function readMultipleChannels(channelIds: string[]): ActionFuncAsync {
    return async (dispatch, getState) => {
        let response;
        try {
            response = await Client4.readMultipleChannels(channelIds);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(markMultipleChannelsAsRead(response.last_viewed_at_times));

        return {data: true};
    };
}

export function getChannels(teamId: string, page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE): ActionFuncAsync<Channel[]> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.GET_CHANNELS_REQUEST, data: null});

        let channels;
        try {
            channels = await Client4.getChannels(teamId, page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.GET_CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNELS,
                teamId,
                data: channels,
            },
            {
                type: ChannelTypes.GET_CHANNELS_SUCCESS,
            },
        ]));

        return {data: channels};
    };
}

export function getArchivedChannels(teamId: string, page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE): ActionFuncAsync<Channel[]> {
    return async (dispatch, getState) => {
        let channels;
        try {
            channels = await Client4.getArchivedChannels(teamId, page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNELS,
            teamId,
            data: channels,
        });

        return {data: channels};
    };
}

export function getAllChannelsWithCount(page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE, notAssociatedToGroup = '', excludeDefaultChannels = false, includeDeleted = false, excludePolicyConstrained = false): ActionFuncAsync<ChannelsWithTotalCount> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.GET_ALL_CHANNELS_REQUEST, data: null});

        let payload;
        try {
            payload = await Client4.getAllChannels(page, perPage, notAssociatedToGroup, excludeDefaultChannels, true, includeDeleted, excludePolicyConstrained);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.GET_ALL_CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_ALL_CHANNELS,
                data: payload.channels,
            },
            {
                type: ChannelTypes.GET_ALL_CHANNELS_SUCCESS,
            },
            {
                type: ChannelTypes.RECEIVED_TOTAL_CHANNEL_COUNT,
                data: payload.total_count,
            },
        ]));

        return {data: payload};
    };
}

export function getAllChannels(page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE, notAssociatedToGroup = '', excludeDefaultChannels = false, excludePolicyConstrained = false): ActionFuncAsync<ChannelWithTeamData[]> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.GET_ALL_CHANNELS_REQUEST, data: null});

        let channels;
        try {
            channels = await Client4.getAllChannels(page, perPage, notAssociatedToGroup, excludeDefaultChannels, false, false, excludePolicyConstrained);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.GET_ALL_CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_ALL_CHANNELS,
                data: channels,
            },
            {
                type: ChannelTypes.GET_ALL_CHANNELS_SUCCESS,
            },
        ]));

        return {data: channels};
    };
}

export function autocompleteChannels(teamId: string, term: string): ActionFuncAsync<Channel[]> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.GET_CHANNELS_REQUEST, data: null});

        let channels;
        try {
            channels = await Client4.autocompleteChannels(teamId, term);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.GET_CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNELS,
                teamId,
                data: channels,
            },
            {
                type: ChannelTypes.GET_CHANNELS_SUCCESS,
            },
        ]));

        return {data: channels};
    };
}

export function autocompleteChannelsForSearch(teamId: string, term: string): ActionFuncAsync<Channel[]> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.GET_CHANNELS_REQUEST, data: null});

        let channels;
        try {
            channels = await Client4.autocompleteChannelsForSearch(teamId, term);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.GET_CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNELS,
                teamId,
                data: channels,
            },
            {
                type: ChannelTypes.GET_CHANNELS_SUCCESS,
            },
        ]));

        return {data: channels};
    };
}

export function searchChannels(teamId: string, term: string, archived?: boolean): ActionFuncAsync<Channel[]> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.GET_CHANNELS_REQUEST, data: null});

        let channels;
        try {
            if (archived) {
                channels = await Client4.searchArchivedChannels(teamId, term);
            } else {
                channels = await Client4.searchChannels(teamId, term);
            }
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.GET_CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNELS,
                teamId,
                data: channels,
            },
            {
                type: ChannelTypes.GET_CHANNELS_SUCCESS,
            },
        ]));

        return {data: channels};
    };
}

export function searchAllChannels(term: string, opts: {page: number; per_page: number} & ChannelSearchOpts): ActionFuncAsync<ChannelsWithTotalCount>;
export function searchAllChannels(term: string, opts: Omit<ChannelSearchOpts, 'page' | 'per_page'> | undefined): ActionFuncAsync<ChannelWithTeamData[]>;
export function searchAllChannels(term: string, opts: ChannelSearchOpts = {}): ActionFuncAsync<Channel[] | ChannelsWithTotalCount> {
    return async (dispatch, getState) => {
        dispatch({type: ChannelTypes.GET_ALL_CHANNELS_REQUEST, data: null});

        let response;
        try {
            response = await Client4.searchAllChannels(term, opts);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.GET_ALL_CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        const channels = 'channels' in response ? response.channels : response;

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_ALL_CHANNELS,
                data: channels,
            },
            {
                type: ChannelTypes.GET_ALL_CHANNELS_SUCCESS,
            },
        ]));

        return {data: response};
    };
}

export function searchGroupChannels(term: string) {
    return bindClientFunc({
        clientFunc: Client4.searchGroupChannels,
        params: [term],
    });
}

export function getChannelStats(channelId: string, includeFileCount?: boolean): ActionFuncAsync<ChannelStats> {
    return async (dispatch, getState) => {
        let stat;
        try {
            stat = await Client4.getChannelStats(channelId, includeFileCount);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL_STATS,
            data: stat,
        });

        return {data: stat};
    };
}

export function getChannelsMemberCount(channelIds: string[]): ActionFuncAsync<Record<string, number>> {
    return async (dispatch, getState) => {
        let channelsMemberCount;

        try {
            channelsMemberCount = await Client4.getChannelsMemberCount(channelIds);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNELS_MEMBER_COUNT,
            data: channelsMemberCount,
        });

        return {data: channelsMemberCount};
    };
}

export function addChannelMember(channelId: string, userId: string, postRootId = ''): ActionFuncAsync<ChannelMembership> {
    return async (dispatch, getState) => {
        let member;
        try {
            member = await Client4.addToChannel(userId, channelId, postRootId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        Client4.trackEvent('action', 'action_channels_add_member', {channel_id: channelId});

        const membersInChannel = getState().entities.channels.membersInChannel[channelId];
        if (!(membersInChannel && userId in membersInChannel)) {
            dispatch(batchActions([
                {
                    type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
                    data: {id: channelId, user_id: userId},
                },
                {
                    type: ChannelTypes.RECEIVED_CHANNEL_MEMBER,
                    data: member,
                },
                {
                    type: ChannelTypes.ADD_CHANNEL_MEMBER_SUCCESS,
                    id: channelId,
                },
            ], 'ADD_CHANNEL_MEMBER.BATCH'));
        }

        return {data: member};
    };
}

export function removeChannelMember(channelId: string, userId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.removeFromChannel(userId, channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        Client4.trackEvent('action', 'action_channels_remove_member', {channel_id: channelId});

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
                data: {id: channelId, user_id: userId},
            },
            {
                type: ChannelTypes.REMOVE_CHANNEL_MEMBER_SUCCESS,
                id: channelId,
            },
        ], 'REMOVE_CHANNEL_MEMBER.BATCH'));

        return {data: true};
    };
}

export function markChannelAsRead(channelId: string, skipUpdateViewTime = false): ActionFunc {
    return (dispatch, getState) => {
        if (skipUpdateViewTime) {
            dispatch(updateApproximateViewTime(channelId));
        }
        dispatch(markChannelAsViewedOnServer(channelId));

        const actions = actionsToMarkChannelAsRead(getState, channelId);
        if (actions.length > 0) {
            dispatch(batchActions(actions));
        }

        return {data: true};
    };
}

export function markMultipleChannelsAsRead(channelTimes: Record<string, number>): ActionFunc {
    return (dispatch, getState) => {
        const actions: AnyAction[] = [];
        for (const id of Object.keys(channelTimes)) {
            actions.push(...actionsToMarkChannelAsRead(getState, id, channelTimes[id]));
        }

        if (actions.length > 0) {
            dispatch(batchActions(actions));
        }

        return {data: true};
    };
}

export function markChannelAsViewedOnServer(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.viewMyChannel(channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        // const actions: AnyAction[] = [];
        // for (const id of Object.keys(response.last_viewed_at_times)) {
        //     actions.push({
        //         type: ChannelTypes.RECEIVED_LAST_VIEWED_AT,
        //         data: {
        //             channel_id: channelId,
        //             last_viewed_at: response.last_viewed_at_times[id],
        //         },
        //     });
        // }

        return {data: true};
    };
}

export function actionsToMarkChannelAsRead(getState: GetStateFunc, channelId: string, viewedAt = Date.now()) {
    const state = getState();
    const {channels, messageCounts, myMembers} = state.entities.channels;

    // Update channel member objects to set all mentions and posts as viewed
    const channel = channels[channelId];
    const messageCount = messageCounts[channelId];

    // Update team member objects to set mentions and posts in channel as viewed
    const channelMember = myMembers[channelId];

    const actions: AnyAction[] = [];

    if (channel && channelMember) {
        actions.push({
            type: ChannelTypes.DECREMENT_UNREAD_MSG_COUNT,
            data: {
                teamId: channel.team_id,
                channelId,
                amount: messageCount.total - channelMember.msg_count,
                amountRoot: messageCount.root - channelMember.msg_count_root,
            },
        });

        actions.push({
            type: ChannelTypes.DECREMENT_UNREAD_MENTION_COUNT,
            data: {
                teamId: channel.team_id,
                channelId,
                amount: channelMember.mention_count,
                amountRoot: channelMember.mention_count_root,
                amountUrgent: channelMember.urgent_mention_count,
            },
        });

        actions.push({
            type: ChannelTypes.RECEIVED_LAST_VIEWED_AT,
            data: {
                channel_id: channelId,
                last_viewed_at: viewedAt,
            },
        });
    }

    if (channel && isManuallyUnread(getState(), channelId)) {
        actions.push({
            type: ChannelTypes.REMOVE_MANUALLY_UNREAD,
            data: {channelId},
        });
    }

    return actions;
}

export function actionsToMarkChannelAsUnread(getState: GetStateFunc, teamId: string, channelId: string, mentions: string[], fetchedChannelMember = false, isRoot = false, priority = '') {
    const state = getState();
    const {myMembers} = state.entities.channels;
    const {currentUserId} = state.entities.users;

    const actions: AnyAction[] = [{
        type: ChannelTypes.INCREMENT_UNREAD_MSG_COUNT,
        data: {
            teamId,
            channelId,
            amount: 1,
            amountRoot: isRoot ? 1 : 0,
            onlyMentions: myMembers[channelId] && myMembers[channelId].notify_props &&
                myMembers[channelId].notify_props.mark_unread === MarkUnread.MENTION,
            fetchedChannelMember,
        },
    }];

    if (!fetchedChannelMember) {
        actions.push({
            type: ChannelTypes.INCREMENT_TOTAL_MSG_COUNT,
            data: {
                channelId,
                amountRoot: isRoot ? 1 : 0,
                amount: 1,
            },
        });
    }

    if (mentions && mentions.indexOf(currentUserId) !== -1) {
        actions.push({
            type: ChannelTypes.INCREMENT_UNREAD_MENTION_COUNT,
            data: {
                teamId,
                channelId,
                amountRoot: isRoot ? 1 : 0,
                amount: 1,
                amountUrgent: priority === 'urgent' ? 1 : 0,
                fetchedChannelMember,
            },
        });
    }

    return actions;
}

export function getChannelMembersByIds(channelId: string, userIds: string[]) {
    return bindClientFunc({
        clientFunc: Client4.getChannelMembersByIds,
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MEMBERS,
        params: [
            channelId,
            userIds,
        ],
    });
}

export function getChannelMember(channelId: string, userId: string) {
    return bindClientFunc({
        clientFunc: Client4.getChannelMember,
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MEMBER,
        params: [
            channelId,
            userId,
        ],
    });
}

export function getMyChannelMember(channelId: string) {
    return bindClientFunc({
        clientFunc: Client4.getMyChannelMember,
        onSuccess: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
        params: [
            channelId,
        ],
    });
}

export function loadMyChannelMemberAndRole(channelId: string): ActionFuncAsync {
    return async (dispatch) => {
        const result = await dispatch(getMyChannelMember(channelId));
        const roles = result.data?.roles.split(' ');
        if (roles && roles.length > 0) {
            dispatch(loadRolesIfNeeded(roles));
        }
        return {data: true};
    };
}

// favoriteChannel moves the provided channel into the current team's Favorites category.
export function favoriteChannel(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const channel = getChannelSelector(state, channelId);
        const category = getCategoryInTeamByType(state, channel.team_id || getCurrentTeamId(state), CategoryTypes.FAVORITES);

        Client4.trackEvent('action', 'action_channels_favorite');

        if (!category) {
            return {data: false};
        }

        return dispatch(addChannelToCategory(category.id, channelId));
    };
}

// unfavoriteChannel moves the provided channel into the current team's Channels/DMs category.
export function unfavoriteChannel(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const channel = getChannelSelector(state, channelId);
        const category = getCategoryInTeamByType(
            state,
            channel.team_id || getCurrentTeamId(state),
            channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL ? CategoryTypes.DIRECT_MESSAGES : CategoryTypes.CHANNELS,
        );

        Client4.trackEvent('action', 'action_channels_unfavorite');

        if (!category) {
            return {data: false};
        }

        return dispatch(addChannelToCategory(category.id, channel.id));
    };
}

export function updateChannelScheme(channelId: string, schemeId: string) {
    return bindClientFunc({
        clientFunc: async () => {
            await Client4.updateChannelScheme(channelId, schemeId);
            return {channelId, schemeId};
        },
        onSuccess: ChannelTypes.UPDATED_CHANNEL_SCHEME,
    });
}

export function updateChannelMemberSchemeRoles(channelId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) {
    return bindClientFunc({
        clientFunc: async () => {
            await Client4.updateChannelMemberSchemeRoles(channelId, userId, isSchemeUser, isSchemeAdmin);
            return {channelId, userId, isSchemeUser, isSchemeAdmin};
        },
        onSuccess: ChannelTypes.UPDATED_CHANNEL_MEMBER_SCHEME_ROLES,
    });
}

export function membersMinusGroupMembers(channelID: string, groupIDs: string[], page = 0, perPage: number = General.PROFILE_CHUNK_SIZE) {
    return bindClientFunc({
        clientFunc: Client4.channelMembersMinusGroupMembers,
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MEMBERS_MINUS_GROUP_MEMBERS,
        params: [
            channelID,
            groupIDs,
            page,
            perPage,
        ],
    });
}

export function getChannelModerations(channelId: string) {
    return bindClientFunc({
        clientFunc: async () => {
            const moderations = await Client4.getChannelModerations(channelId);
            return {channelId, moderations};
        },
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MODERATIONS,
    });
}

export function patchChannelModerations(channelId: string, patch: ChannelModerationPatch[]) {
    return bindClientFunc({
        clientFunc: async () => {
            const moderations = await Client4.patchChannelModerations(channelId, patch);
            return {channelId, moderations};
        },
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MODERATIONS,
    });
}

export function getChannelMemberCountsByGroup(channelId: string) {
    return bindClientFunc({
        clientFunc: async () => {
            const channelMemberCountsByGroup = await Client4.getChannelMemberCountsByGroup(channelId, true);
            return {channelId, memberCounts: channelMemberCountsByGroup};
        },
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MEMBER_COUNTS_BY_GROUP,
    });
}

export default {
    selectChannel,
    createChannel,
    createDirectChannel,
    patchChannel,
    updateChannelNotifyProps,
    getChannel,
    fetchChannelsAndMembers,
    getChannelTimezones,
    getChannelMembersByIds,
    leaveChannel,
    joinChannel,
    deleteChannel,
    unarchiveChannel,
    getChannels,
    autocompleteChannels,
    autocompleteChannelsForSearch,
    searchChannels,
    searchGroupChannels,
    getChannelStats,
    addChannelMember,
    removeChannelMember,
    markChannelAsRead,
    favoriteChannel,
    unfavoriteChannel,
    membersMinusGroupMembers,
    getChannelModerations,
    getChannelMemberCountsByGroup,
};
