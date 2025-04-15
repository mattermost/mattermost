// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {AccessControlPoliciesResult, AccessControlPolicy} from '@mattermost/types/admin';
import type {ChannelSearchOpts, ChannelsWithTotalCount} from '@mattermost/types/channels';
import type {StatusOK} from '@mattermost/types/client4';
import type {ServerError} from '@mattermost/types/errors';

import {AdminTypes, ChannelTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {forceLogoutIfNecessary} from './helpers';

export function getAccessControlPolicy(id: string): ActionFuncAsync<AccessControlPolicy> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getAccessControlPolicy(id);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICY,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICY, data},
        );

        return {data};
    };
}

export function createAccessControlPolicy(policy: AccessControlPolicy): ActionFuncAsync<AccessControlPolicy> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.updateOrCreateAccessControlPolicy(policy);
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

export function deleteAccessControlPolicy(id: string): ActionFuncAsync<AccessControlPolicy> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.deleteAccessControlPolicy(id);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        dispatch(
            {type: AdminTypes.DELETE_ACCESS_CONTROL_POLICY_SUCCESS, data},
        );

        return {data};
    };
}

export function searchAccessControlPolicies(term: string, type: string, after: string, limit: number): ActionFuncAsync<AccessControlPoliciesResult> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.searchAccessControlPolicies(term, type, after, limit);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES_SEARCH,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES_SEARCH, data: data.policies},
        );

        return {data};
    };
}

export function searchAccessControlPolicyChannels(id: string, term: string, opts: ChannelSearchOpts): ActionFuncAsync<ChannelsWithTotalCount> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.searchChildAccessControlPolicyChannels(id, term, opts);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES_SEARCH,
                    error,
                },
            );
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

export function assignChannelsToAccessControlPolicy(policyId: string, channelIds: string[]): ActionFuncAsync<StatusOK> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.assignChannelsToAccessControlPolicy(policyId, channelIds);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        return {data};
    };
}

export function unassignChannelsFromAccessControlPolicy(policyId: string, channelIds: string[]): ActionFuncAsync<StatusOK> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.unassignChannelsFromAccessControlPolicy(policyId, channelIds);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        return {data};
    };
}
