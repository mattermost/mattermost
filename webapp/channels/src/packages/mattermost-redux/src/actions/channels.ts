// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Channel,
    ChannelNotifyProps,
    ChannelMembership,
    ChannelModerationPatch,
    ChannelsWithTotalCount,
    ChannelSearchOpts,
    ServerChannel,
} from '@mattermost/types/channels';
import {ServerError} from '@mattermost/types/errors';
import {PreferenceType} from '@mattermost/types/preferences';
import {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

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
import {ActionFunc, ActionResult, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {getChannelByName} from 'mattermost-redux/utils/channel_utils';

import {General, Preferences} from '../constants';

import {addChannelToInitialCategory, addChannelToCategory} from './channel_categories';
import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';
import {savePreferences} from './preferences';
import {loadRolesIfNeeded} from './roles';
import {getMissingProfilesByIds} from './users';

export function selectChannel(channelId: string) {
    return {
        type: ChannelTypes.SELECT_CHANNEL,
        data: channelId,
    };
}

export function createChannel(channel: Channel, userId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function createDirectChannel(userId: string, otherUserId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

        savePreferences(userId, preferences)(dispatch);

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

export function markGroupChannelOpen(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {currentUserId} = getState().entities.users;

        const preferences: PreferenceType[] = [
            {user_id: currentUserId, category: Preferences.CATEGORY_GROUP_CHANNEL_SHOW, name: channelId, value: 'true'},
            {user_id: currentUserId, category: Preferences.CATEGORY_CHANNEL_OPEN_TIME, name: channelId, value: new Date().getTime().toString()},
        ];

        return dispatch(savePreferences(currentUserId, preferences));
    };
}

export function createGroupChannel(userIds: string[]): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function patchChannel(channelId: string, patch: Partial<Channel>): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        dispatch({type: ChannelTypes.UPDATE_CHANNEL_REQUEST, data: null});

        let updated;
        try {
            updated = await Client4.patchChannel(channelId, patch);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch({type: ChannelTypes.UPDATE_CHANNEL_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }
        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: updated,
            },
            {
                type: ChannelTypes.UPDATE_CHANNEL_SUCCESS,
            },
        ]));

        return {data: updated};
    };
}

export function updateChannel(channel: Channel): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        dispatch({type: ChannelTypes.UPDATE_CHANNEL_REQUEST, data: null});

        let updated;
        try {
            updated = await Client4.updateChannel(channel);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch({type: ChannelTypes.UPDATE_CHANNEL_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: updated,
            },
            {
                type: ChannelTypes.UPDATE_CHANNEL_SUCCESS,
            },
        ]));

        return {data: updated};
    };
}

export function updateChannelPrivacy(channelId: string, privacy: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        dispatch({type: ChannelTypes.UPDATE_CHANNEL_REQUEST, data: null});

        let updatedChannel;
        try {
            updatedChannel = await Client4.updateChannelPrivacy(channelId, privacy);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch({type: ChannelTypes.UPDATE_CHANNEL_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: updatedChannel,
            },
            {
                type: ChannelTypes.UPDATE_CHANNEL_SUCCESS,
            },
        ]));

        return {data: updatedChannel};
    };
}

export function updateChannelNotifyProps(userId: string, channelId: string, props: Partial<ChannelNotifyProps>): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getChannelByNameAndTeamName(teamName: string, channelName: string, includeDeleted = false): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getChannel(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getChannelAndMyMember(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getChannelTimezones(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function fetchMyChannelsAndMembersREST(teamId: string): ActionFunc<{channels: ServerChannel[]; channelMembers: ChannelMembership[]}> {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function fetchAllMyTeamsChannelsAndChannelMembersREST(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getChannelMembers(channelId: string, page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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
        getMissingProfilesByIds(userIds)(dispatch, getState);

        dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL_MEMBERS,
            data: channelMembers,
        });

        return {data: channelMembers};
    };
}

export function leaveChannel(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function joinChannel(userId: string, teamId: string, channelId: string, channelName?: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function deleteChannel(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function unarchiveChannel(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function viewChannel(channelId: string, prevChannelId = ''): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {currentUserId} = getState().entities.users;

        const {myPreferences} = getState().entities.preferences;
        const viewTimePref = myPreferences[`${Preferences.CATEGORY_CHANNEL_APPROXIMATE_VIEW_TIME}--${channelId}`];
        const viewTime = viewTimePref ? parseInt(viewTimePref.value!, 10) : 0;
        const prevChanManuallyUnread = isManuallyUnread(getState(), prevChannelId);

        if (viewTime < new Date().getTime() - (3 * 60 * 60 * 1000)) {
            const preferences = [
                {user_id: currentUserId, category: Preferences.CATEGORY_CHANNEL_APPROXIMATE_VIEW_TIME, name: channelId, value: new Date().getTime().toString()},
            ];
            savePreferences(currentUserId, preferences)(dispatch);
        }

        try {
            await Client4.viewMyChannel(channelId, prevChanManuallyUnread ? '' : prevChannelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));

            return {error};
        }

        const actions: AnyAction[] = [];

        const {myMembers} = getState().entities.channels;
        const member = myMembers[channelId];
        if (member) {
            if (isManuallyUnread(getState(), channelId)) {
                actions.push({
                    type: ChannelTypes.REMOVE_MANUALLY_UNREAD,
                    data: {channelId},
                });
            }
            actions.push({
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: {...member, last_viewed_at: new Date().getTime()},
            });
            dispatch(loadRolesIfNeeded(member.roles.split(' ')));
        }

        const prevMember = myMembers[prevChannelId];
        if (!prevChanManuallyUnread && prevMember) {
            actions.push({
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: {...prevMember, last_viewed_at: new Date().getTime()},
            });
            dispatch(loadRolesIfNeeded(prevMember.roles.split(' ')));
        }

        dispatch(batchActions(actions));

        return {data: true};
    };
}

export function markChannelAsViewed(channelId: string, prevChannelId?: string): ActionFunc {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const actions = actionsToMarkChannelAsViewed(getState, channelId, prevChannelId);

        return dispatch(batchActions(actions));
    };
}

export function actionsToMarkChannelAsViewed(getState: GetStateFunc, channelId: string, prevChannelId = '') {
    const actions: AnyAction[] = [];

    const state = getState();
    const {myMembers} = state.entities.channels;

    const member = myMembers[channelId];
    if (member) {
        actions.push({
            type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
            data: {...member, last_viewed_at: Date.now()},
        });

        if (isManuallyUnread(state, channelId)) {
            actions.push({
                type: ChannelTypes.REMOVE_MANUALLY_UNREAD,
                data: {channelId},
            });
        }
    }

    const prevMember = myMembers[prevChannelId];
    if (prevMember && !isManuallyUnread(state, prevChannelId)) {
        actions.push({
            type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
            data: {...prevMember, last_viewed_at: Date.now()},
        });
    }

    return actions;
}

export function getChannels(teamId: string, page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getArchivedChannels(teamId: string, page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getAllChannelsWithCount(page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE, notAssociatedToGroup = '', excludeDefaultChannels = false, includeDeleted = false, excludePolicyConstrained = false): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        dispatch({type: ChannelTypes.GET_ALL_CHANNELS_REQUEST, data: null});

        let payload;
        try {
            payload = await Client4.getAllChannels(page, perPage, notAssociatedToGroup, excludeDefaultChannels, true, includeDeleted, excludePolicyConstrained) as ChannelsWithTotalCount;
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

export function getAllChannels(page = 0, perPage: number = General.CHANNELS_CHUNK_SIZE, notAssociatedToGroup = '', excludeDefaultChannels = false, excludePolicyConstrained = false): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function autocompleteChannels(teamId: string, term: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function autocompleteChannelsForSearch(teamId: string, term: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function searchChannels(teamId: string, term: string, archived?: boolean): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function searchAllChannels(term: string, opts: ChannelSearchOpts = {}): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        dispatch({type: ChannelTypes.GET_ALL_CHANNELS_REQUEST, data: null});

        let response;
        try {
            response = await Client4.searchAllChannels(term, opts) as ChannelsWithTotalCount;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: ChannelTypes.GET_ALL_CHANNELS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        const channels = response.channels || response;

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

export function searchGroupChannels(term: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.searchGroupChannels,
        params: [term],
    });
}

export function getChannelStats(channelId: string, includeFileCount?: boolean): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getChannelsMemberCount(channelIds: string[]): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function addChannelMember(channelId: string, userId: string, postRootId = ''): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let member;
        try {
            member = await Client4.addToChannel(userId, channelId, postRootId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        Client4.trackEvent('action', 'action_channels_add_member', {channel_id: channelId});

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

        return {data: member};
    };
}

export function removeChannelMember(channelId: string, userId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function updateChannelMemberRoles(channelId: string, userId: string, roles: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        try {
            await Client4.updateChannelMemberRoles(channelId, userId, roles);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const membersInChannel = getState().entities.channels.membersInChannel[channelId];
        if (membersInChannel && membersInChannel[userId]) {
            dispatch({
                type: ChannelTypes.RECEIVED_CHANNEL_MEMBER,
                data: {...membersInChannel[userId], roles},
            });
        }

        return {data: true};
    };
}

export function updateChannelHeader(channelId: string, header: string): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        Client4.trackEvent('action', 'action_channels_update_header', {channel_id: channelId});

        dispatch({
            type: ChannelTypes.UPDATE_CHANNEL_HEADER,
            data: {
                channelId,
                header,
            },
        });

        return {data: true};
    };
}

export function updateChannelPurpose(channelId: string, purpose: string): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        Client4.trackEvent('action', 'action_channels_update_purpose', {channel_id: channelId});

        dispatch({
            type: ChannelTypes.UPDATE_CHANNEL_PURPOSE,
            data: {
                channelId,
                purpose,
            },
        });

        return {data: true};
    };
}

export function markChannelAsRead(channelId: string, prevChannelId?: string, updateLastViewedAt = true): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const prevChanManuallyUnread = isManuallyUnread(state, prevChannelId);

        const actions = actionsToMarkChannelAsRead(getState, channelId, prevChannelId);

        // Send channel last viewed at to the server
        if (updateLastViewedAt) {
            dispatch(markChannelAsViewedOnServer(channelId, prevChanManuallyUnread ? '' : prevChannelId));

            const now = Date.now();

            // Don't use actionsToMarkChannelAsViewed here because that overwrites fields modified by
            // actionsToMarkChannelAsRead
            actions.push({
                type: ChannelTypes.RECEIVED_LAST_VIEWED_AT,
                data: {
                    channel_id: channelId,
                    last_viewed_at: now,
                },
            });

            if (prevChannelId && !prevChanManuallyUnread) {
                actions.push({
                    type: ChannelTypes.RECEIVED_LAST_VIEWED_AT,
                    data: {
                        channel_id: prevChannelId,
                        last_viewed_at: now,
                    },
                });
            }
        }

        if (actions.length > 0) {
            dispatch(batchActions(actions));
        }

        return {data: true};
    };
}

export function markChannelAsViewedOnServer(channelId: string, prevChannelId?: string): ActionFunc {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        Client4.viewMyChannel(channelId, prevChannelId).then().catch((error) => {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        });

        return {data: true};
    };
}

export function actionsToMarkChannelAsRead(getState: GetStateFunc, channelId: string, prevChannelId?: string) {
    const state = getState();
    const {channels, messageCounts, myMembers} = state.entities.channels;

    const prevChanManuallyUnread = isManuallyUnread(state, prevChannelId);

    // Update channel member objects to set all mentions and posts as viewed
    const channel = channels[channelId];
    const messageCount = messageCounts[channelId];
    const prevChannel = (!prevChanManuallyUnread && prevChannelId) ? channels[prevChannelId] : null; // May be null since prevChannelId is optional
    const prevMessageCount = (!prevChanManuallyUnread && prevChannelId) ? messageCounts[prevChannelId] : null;

    // Update team member objects to set mentions and posts in channel as viewed
    const channelMember = myMembers[channelId];
    const prevChannelMember = (!prevChanManuallyUnread && prevChannelId) ? myMembers[prevChannelId] : null; // May also be null

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
    }

    if (channel && isManuallyUnread(getState(), channelId)) {
        actions.push({
            type: ChannelTypes.REMOVE_MANUALLY_UNREAD,
            data: {channelId},
        });
    }

    if (prevChannel && prevChannelMember && prevMessageCount) {
        actions.push({
            type: ChannelTypes.DECREMENT_UNREAD_MSG_COUNT,
            data: {
                teamId: prevChannel.team_id,
                channelId: prevChannelId,
                amount: prevMessageCount.total - prevChannelMember.msg_count,
                amountRoot: prevMessageCount.root - prevChannelMember.msg_count_root,
            },
        });

        actions.push({
            type: ChannelTypes.DECREMENT_UNREAD_MENTION_COUNT,
            data: {
                teamId: prevChannel.team_id,
                channelId: prevChannelId,
                amount: prevChannelMember.mention_count,
                amountRoot: prevChannelMember.mention_count_root,
                amountUrgent: prevChannelMember.urgent_mention_count,
            },
        });
    }

    return actions;
}

// Increments the number of posts in the channel by 1 and marks it as unread if necessary
export function markChannelAsUnread(teamId: string, channelId: string, mentions: string[], fetchedChannelMember = false, isRoot = false): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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
                    fetchedChannelMember,
                },
            });
        }

        dispatch(batchActions(actions));

        return {data: true};
    };
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

export function loadMyChannelMemberAndRole(channelId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const result = await getMyChannelMember(channelId)(dispatch, getState) as ActionResult;
        const roles = result.data?.roles.split(' ');
        if (roles && roles.length > 0) {
            dispatch(loadRolesIfNeeded(roles));
        }
        return {data: true};
    };
}

// favoriteChannel moves the provided channel into the current team's Favorites category.
export function favoriteChannel(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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
export function unfavoriteChannel(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function membersMinusGroupMembers(channelID: string, groupIDs: string[], page = 0, perPage: number = General.PROFILE_CHUNK_SIZE): ActionFunc {
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

export function getChannelModerations(channelId: string): ActionFunc {
    return bindClientFunc({
        clientFunc: async () => {
            const moderations = await Client4.getChannelModerations(channelId);
            return {channelId, moderations};
        },
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MODERATIONS,
        params: [
            channelId,
        ],
    });
}

export function patchChannelModerations(channelId: string, patch: ChannelModerationPatch[]): ActionFunc {
    return bindClientFunc({
        clientFunc: async () => {
            const moderations = await Client4.patchChannelModerations(channelId, patch);
            return {channelId, moderations};
        },
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MODERATIONS,
        params: [
            channelId,
        ],
    });
}

export function getChannelMemberCountsByGroup(channelId: string, includeTimezones: boolean): ActionFunc {
    return bindClientFunc({
        clientFunc: async () => {
            const channelMemberCountsByGroup = await Client4.getChannelMemberCountsByGroup(channelId, includeTimezones);
            return {channelId, memberCounts: channelMemberCountsByGroup};
        },
        onSuccess: ChannelTypes.RECEIVED_CHANNEL_MEMBER_COUNTS_BY_GROUP,
        params: [
            channelId,
        ],
    });
}

export default {
    selectChannel,
    createChannel,
    createDirectChannel,
    updateChannel,
    patchChannel,
    updateChannelNotifyProps,
    getChannel,
    fetchMyChannelsAndMembersREST,
    getChannelTimezones,
    getChannelMembersByIds,
    leaveChannel,
    joinChannel,
    deleteChannel,
    unarchiveChannel,
    viewChannel,
    markChannelAsViewed,
    getChannels,
    autocompleteChannels,
    autocompleteChannelsForSearch,
    searchChannels,
    searchGroupChannels,
    getChannelStats,
    addChannelMember,
    removeChannelMember,
    updateChannelHeader,
    updateChannelPurpose,
    markChannelAsRead,
    markChannelAsUnread,
    favoriteChannel,
    unfavoriteChannel,
    membersMinusGroupMembers,
    getChannelModerations,
    getChannelMemberCountsByGroup,
};
