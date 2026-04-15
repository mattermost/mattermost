// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {AccessControlPoliciesResult, AccessControlPolicy, AccessControlPolicyActiveUpdate, AccessControlTestResult} from '@mattermost/types/access_control';
import type {ChannelSearchOpts, ChannelsWithTotalCount} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {AdminTypes, ChannelTypes, UserTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

export function getAccessControlPolicy(id: string, channelId?: string, teamId?: string) {
    return bindClientFunc({
        clientFunc: () => Client4.getAccessControlPolicy(id, channelId, teamId),
        onSuccess: [AdminTypes.RECEIVED_ACCESS_CONTROL_POLICY],
        params: [],
    });
}

export function createAccessControlPolicy(policy: AccessControlPolicy, teamId?: string): ActionFuncAsync<AccessControlPolicy> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.updateOrCreateAccessControlPolicy(policy, teamId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        dispatch(
            {type: AdminTypes.CREATE_ACCESS_CONTROL_POLICY_SUCCESS, data},
        );

        return {data};
    };
}

export function deleteAccessControlPolicy(id: string, teamId?: string) {
    return bindClientFunc({
        clientFunc: () => Client4.deleteAccessControlPolicy(id, teamId),
        onSuccess: [AdminTypes.DELETE_ACCESS_CONTROL_POLICY_SUCCESS],
        params: [],
    });
}

export function searchAccessControlPolicies(term: string, type: string, after: string, limit: number): ActionFuncAsync<AccessControlPoliciesResult> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.searchAccessControlPolicies(term, type, after, limit);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES_SEARCH, data: data.policies},
        );

        return {data};
    };
}

export function searchTeamAccessControlPolicies(teamId: string, term: string, type: string, after: string, limit: number): ActionFuncAsync<AccessControlPoliciesResult> {
    return async (dispatch, getState) => {
        if (!teamId) {
            return {error: new Error('teamId is required for team-scoped policy search')};
        }

        let data;
        try {
            data = await Client4.searchAccessControlPolicies(term, type, after, limit, teamId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES_SEARCH, data: data.policies},
        );

        return {data};
    };
}

export function searchAccessControlPolicyChannels(id: string, term: string, opts: ChannelSearchOpts, teamId?: string): ActionFuncAsync<ChannelsWithTotalCount> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.searchChildAccessControlPolicyChannels(id, term, opts, teamId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        const childs: Record<string, string[]> = {};
        childs[id] = data.channels.map((channel) => channel.id);

        dispatch(batchActions([
            {type: AdminTypes.RECEIVED_ACCESS_CONTROL_CHILD_POLICIES, data: childs},
            {type: ChannelTypes.RECEIVED_CHANNELS, data: data.channels},
        ]));

        return {data};
    };
}

export function assignChannelsToAccessControlPolicy(policyId: string, channelIds: string[], teamId?: string) {
    return bindClientFunc({
        clientFunc: () => Client4.assignChannelsToAccessControlPolicy(policyId, channelIds, teamId),
        onSuccess: [AdminTypes.ASSIGN_CHANNELS_TO_ACCESS_CONTROL_POLICY_SUCCESS],
        params: [],
    });
}

export function unassignChannelsFromAccessControlPolicy(policyId: string, channelIds: string[], teamId?: string) {
    return bindClientFunc({
        clientFunc: () => Client4.unassignChannelsFromAccessControlPolicy(policyId, channelIds, teamId),
        onSuccess: [AdminTypes.UNASSIGN_CHANNELS_FROM_ACCESS_CONTROL_POLICY_SUCCESS],
        params: [],
    });
}

export function getAccessControlFields(after: string, limit: number, channelId?: string, teamId?: string) {
    return bindClientFunc({
        clientFunc: () => Client4.getAccessControlFields(after, limit, channelId, teamId),
        params: [],
    });
}

export function searchUsersForExpression(expression: string, term: string, after: string, limit: number, channelId?: string, teamId?: string): ActionFuncAsync<AccessControlTestResult> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.testAccessControlExpression(expression, term, after, limit, channelId, teamId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        dispatch(
            {type: UserTypes.RECEIVED_PROFILES, data: data.users},
        );

        return {data};
    };
}

export function getVisualAST(expression: string, channelId?: string, teamId?: string) {
    return bindClientFunc({
        clientFunc: () => Client4.expressionToVisualFormat(expression, channelId, teamId),
        params: [],
    });
}

export function validateExpressionAgainstRequester(expression: string, channelId?: string, teamId?: string): ActionFuncAsync<{requester_matches: boolean}> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.validateExpressionAgainstRequester(expression, channelId, teamId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }
        return {data};
    };
}

export function createAccessControlSyncJob(jobData: {policy_id?: string; team_id?: string}): ActionFuncAsync<any> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.createAccessControlSyncJob(jobData);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }
        return {data};
    };
}

export function updateAccessControlPoliciesActive(states: AccessControlPolicyActiveUpdate[], teamId?: string) {
    return bindClientFunc({
        clientFunc: Client4.updateAccessControlPoliciesActive,
        params: [states, teamId],
    });
}
