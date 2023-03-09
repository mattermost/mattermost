// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import {ChannelTypes, GroupTypes, UserTypes} from 'mattermost-redux/action_types';
import {General} from 'mattermost-redux/constants';
import {Client4} from 'mattermost-redux/client';

import {ActionFunc, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {GroupPatch, SyncableType, SyncablePatch, GroupCreateWithUserIds, CustomGroupPatch, GroupSearachParams, GroupSource} from '@mattermost/types/groups';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

export function linkGroupSyncable(groupID: string, syncableID: string, syncableType: SyncableType, patch: SyncablePatch): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.linkGroupSyncable(groupID, syncableID, syncableType, patch);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const dispatches: AnyAction[] = [];
        let type = '';
        switch (syncableType) {
        case SyncableType.Team:
            dispatches.push({type: GroupTypes.RECEIVED_GROUP_ASSOCIATED_TO_TEAM, data: {teamID: syncableID, groups: [{id: groupID}]}});
            type = GroupTypes.LINKED_GROUP_TEAM;
            break;
        case SyncableType.Channel:
            type = GroupTypes.LINKED_GROUP_CHANNEL;
            break;
        default:
            console.warn(`unhandled syncable type ${syncableType}`); // eslint-disable-line no-console
        }

        dispatches.push({type, data});
        dispatch(batchActions(dispatches));

        return {data: true};
    };
}

export function unlinkGroupSyncable(groupID: string, syncableID: string, syncableType: SyncableType): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        try {
            await Client4.unlinkGroupSyncable(groupID, syncableID, syncableType);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const dispatches: AnyAction[] = [];

        let type = '';
        const data = {group_id: groupID, syncable_id: syncableID};
        switch (syncableType) {
        case SyncableType.Team:
            type = GroupTypes.UNLINKED_GROUP_TEAM;
            data.syncable_id = syncableID;
            dispatches.push({type: GroupTypes.RECEIVED_GROUPS_NOT_ASSOCIATED_TO_TEAM, data: {teamID: syncableID, groups: [{id: groupID}]}});
            break;
        case SyncableType.Channel:
            type = GroupTypes.UNLINKED_GROUP_CHANNEL;
            data.syncable_id = syncableID;
            break;
        default:
            console.warn(`unhandled syncable type ${syncableType}`); // eslint-disable-line no-console
        }

        dispatches.push({type, data});
        dispatch(batchActions(dispatches));

        return {data: true};
    };
}

export function getGroupSyncables(groupID: string, syncableType: SyncableType): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.getGroupSyncables(groupID, syncableType);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        let type = '';
        switch (syncableType) {
        case SyncableType.Team:
            type = GroupTypes.RECEIVED_GROUP_TEAMS;
            break;
        case SyncableType.Channel:
            type = GroupTypes.RECEIVED_GROUP_CHANNELS;
            break;
        default:
            console.warn(`unhandled syncable type ${syncableType}`); // eslint-disable-line no-console
        }

        dispatch(batchActions([
            {type, data, group_id: groupID},
        ]));

        return {data: true};
    };
}

export function patchGroupSyncable(groupID: string, syncableID: string, syncableType: SyncableType, patch: SyncablePatch): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.patchGroupSyncable(groupID, syncableID, syncableType, patch);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        const dispatches: AnyAction[] = [];

        let type = '';
        switch (syncableType) {
        case SyncableType.Team:
            type = GroupTypes.PATCHED_GROUP_TEAM;
            break;
        case SyncableType.Channel:
            type = GroupTypes.PATCHED_GROUP_CHANNEL;
            break;
        default:
            console.warn(`unhandled syncable type ${syncableType}`); // eslint-disable-line no-console
        }

        dispatches.push(
            {type, data},
        );
        dispatch(batchActions(dispatches));

        return {data: true};
    };
}

export function getGroup(id: string, includeMemberCount = false): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getGroup,
        onSuccess: [GroupTypes.RECEIVED_GROUP],
        params: [
            id,
            includeMemberCount,
        ],
    });
}

export function getGroups(filterAllowReference = false, page = 0, perPage = 10, includeMemberCount = false): ActionFunc {
    return bindClientFunc({
        clientFunc: async (param1, param2, param3, param4) => {
            const result = await Client4.getGroups(param1, param2, param3, param4);
            return result;
        },
        onSuccess: [GroupTypes.RECEIVED_GROUPS],
        params: [
            filterAllowReference,
            page,
            perPage,
            includeMemberCount,
        ],
    });
}

export function getGroupsNotAssociatedToTeam(teamID: string, q = '', page = 0, perPage: number = General.PAGE_SIZE_DEFAULT, source = GroupSource.Ldap): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getGroupsNotAssociatedToTeam,
        onSuccess: [GroupTypes.RECEIVED_GROUPS],
        params: [
            teamID,
            q,
            page,
            perPage,
            source,
        ],
    });
}

export function getGroupsNotAssociatedToChannel(channelID: string, q = '', page = 0, perPage: number = General.PAGE_SIZE_DEFAULT, filterParentTeamPermitted = false, source = GroupSource.Ldap): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getGroupsNotAssociatedToChannel,
        onSuccess: [GroupTypes.RECEIVED_GROUPS],
        params: [
            channelID,
            q,
            page,
            perPage,
            filterParentTeamPermitted,
            source,
        ],
    });
}

export function getAllGroupsAssociatedToTeam(teamID: string, filterAllowReference = false, includeMemberCount = false): ActionFunc {
    return bindClientFunc({
        clientFunc: async (param1, param2, param3) => {
            const result = await Client4.getAllGroupsAssociatedToTeam(param1, param2, param3);
            result.teamID = param1;
            return result;
        },
        onSuccess: [GroupTypes.RECEIVED_ALL_GROUPS_ASSOCIATED_TO_TEAM],
        params: [
            teamID,
            filterAllowReference,
            includeMemberCount,
        ],
    });
}

export function getAllGroupsAssociatedToChannelsInTeam(teamID: string, filterAllowReference = false): ActionFunc {
    return bindClientFunc({
        clientFunc: async (param1, param2) => {
            const result = await Client4.getAllGroupsAssociatedToChannelsInTeam(param1, param2);
            return {groupsByChannelId: result.groups};
        },
        onSuccess: [GroupTypes.RECEIVED_ALL_GROUPS_ASSOCIATED_TO_CHANNELS_IN_TEAM],
        params: [
            teamID,
            filterAllowReference,
        ],
    });
}

export function getAllGroupsAssociatedToChannel(channelID: string, filterAllowReference = false, includeMemberCount = false): ActionFunc {
    return bindClientFunc({
        clientFunc: async (param1, param2, param3) => {
            const result = await Client4.getAllGroupsAssociatedToChannel(param1, param2, param3);
            result.channelID = param1;
            return result;
        },
        onSuccess: [GroupTypes.RECEIVED_ALL_GROUPS_ASSOCIATED_TO_CHANNEL],
        params: [
            channelID,
            filterAllowReference,
            includeMemberCount,
        ],
    });
}

export function getGroupsAssociatedToTeam(teamID: string, q = '', page = 0, perPage: number = General.PAGE_SIZE_DEFAULT, filterAllowReference = false): ActionFunc {
    return bindClientFunc({
        clientFunc: async (param1, param2, param3, param4, param5) => {
            const result = await Client4.getGroupsAssociatedToTeam(param1, param2, param3, param4, param5);
            return {groups: result.groups, totalGroupCount: result.total_group_count, teamID: param1};
        },
        onSuccess: [GroupTypes.RECEIVED_GROUPS_ASSOCIATED_TO_TEAM],
        params: [
            teamID,
            q,
            page,
            perPage,
            filterAllowReference,
        ],
    });
}

export function getGroupsAssociatedToChannel(channelID: string, q = '', page = 0, perPage: number = General.PAGE_SIZE_DEFAULT, filterAllowReference = false): ActionFunc {
    return bindClientFunc({
        clientFunc: async (param1, param2, param3, param4, param5) => {
            const result = await Client4.getGroupsAssociatedToChannel(param1, param2, param3, param4, param5);
            return {groups: result.groups, totalGroupCount: result.total_group_count, channelID: param1};
        },
        onSuccess: [GroupTypes.RECEIVED_GROUPS_ASSOCIATED_TO_CHANNEL],
        params: [
            channelID,
            q,
            page,
            perPage,
            filterAllowReference,
        ],
    });
}

export function patchGroup(groupID: string, patch: GroupPatch | CustomGroupPatch): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.patchGroup,
        onSuccess: [GroupTypes.PATCHED_GROUP],
        params: [
            groupID,
            patch,
        ],
    });
}

export function getGroupsByUserId(userID: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getGroupsByUserId,
        onSuccess: [GroupTypes.RECEIVED_MY_GROUPS],
        params: [
            userID,
        ],
    });
}

export function getGroupsByUserIdPaginated(userId: string, filterAllowReference = false, page = 0, perPage: number = General.PAGE_SIZE_DEFAULT, includeMemberCount = false): ActionFunc {
    return bindClientFunc({
        clientFunc: async (param1, param2, param3, param4, param5) => {
            const result = await Client4.getGroups(param1, param2, param3, param4, param5);
            return result;
        },
        onSuccess: [GroupTypes.RECEIVED_MY_GROUPS, GroupTypes.RECEIVED_GROUPS],
        params: [
            filterAllowReference,
            page,
            perPage,
            includeMemberCount,
            userId,
        ],
    });
}

export function getGroupStats(groupID: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getGroupStats,
        onSuccess: [GroupTypes.RECEIVED_GROUP_STATS],
        params: [
            groupID,
        ],
    });
}

export function createGroupWithUserIds(group: GroupCreateWithUserIds): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.createGroupWithUserIds(group);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        dispatch(
            {type: GroupTypes.CREATE_GROUP_SUCCESS, data},
        );

        return {data};
    };
}

export function addUsersToGroup(groupId: string, userIds: string[]): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.addUsersToGroup(groupId, userIds);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        dispatch(
            {
                type: UserTypes.RECEIVED_PROFILES_FOR_GROUP,
                data,
                id: groupId,
            },
        );

        return {data};
    };
}

export function removeUsersFromGroup(groupId: string, userIds: string[]): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.removeUsersFromGroup(groupId, userIds);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        dispatch(
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_TO_REMOVE_FROM_GROUP,
                data,
                id: groupId,
            },
        );

        return {data};
    };
}

export function searchGroups(params: GroupSearachParams): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.searchGroups(params);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const dispatches: AnyAction[] = [{type: GroupTypes.RECEIVED_GROUPS, data}];

        if (params.user_id) {
            dispatches.push({type: GroupTypes.RECEIVED_MY_GROUPS, data});
        }
        if (params.include_channel_member_count) {
            dispatches.push({type: ChannelTypes.RECEIVED_CHANNEL_MEMBER_COUNTS_FROM_GROUPS_LIST, data, channelId: params.include_channel_member_count});
        }
        dispatch(batchActions(dispatches));

        return {data: true};
    };
}

export function archiveGroup(groupId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.archiveGroup(groupId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        dispatch(
            {
                type: GroupTypes.ARCHIVED_GROUP,
                id: groupId,
            },
        );

        return {data};
    };
}

export function createGroupTeamsAndChannels(userID: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        try {
            await Client4.createGroupTeamsAndChannels(userID);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }
        return {user_id: userID};
    };
}
