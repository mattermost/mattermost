// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {AccessControlPoliciesResult, AccessControlPolicy} from '@mattermost/types/admin';
import type {ChannelSearchOpts, ChannelsWithTotalCount} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {AdminTypes, ChannelTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

export function getAccessControlPolicy(id: string) {
    return bindClientFunc({
        clientFunc: Client4.getAccessControlPolicy,
        onSuccess: [AdminTypes.RECEIVED_ACCESS_CONTROL_POLICY],
        params: [
            id,
        ],
    });
}

export function createAccessControlPolicy(policy: AccessControlPolicy) {
    return bindClientFunc({
        clientFunc: Client4.updateOrCreateAccessControlPolicy,
        onSuccess: [AdminTypes.CREATE_ACCESS_CONTROL_POLICY_SUCCESS],
        params: [
            policy,
        ],
    });
}

export function deleteAccessControlPolicy(id: string) {
    return bindClientFunc({
        clientFunc: Client4.deleteAccessControlPolicy,
        onSuccess: [AdminTypes.DELETE_ACCESS_CONTROL_POLICY_SUCCESS],
        params: [
            id,
        ],
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

export function searchAccessControlPolicyChannels(id: string, term: string, opts: ChannelSearchOpts): ActionFuncAsync<ChannelsWithTotalCount> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.searchChildAccessControlPolicyChannels(id, term, opts);
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

export function assignChannelsToAccessControlPolicy(policyId: string, channelIds: string[]) {
    return bindClientFunc({
        clientFunc: Client4.assignChannelsToAccessControlPolicy,
        params: [
            policyId,
            channelIds,
        ],
    });
}

export function unassignChannelsFromAccessControlPolicy(policyId: string, channelIds: string[]) {
    return bindClientFunc({
        clientFunc: Client4.unassignChannelsFromAccessControlPolicy,
        params: [
            policyId,
            channelIds,
        ],
    });
}

export function getAccessControlFields(after: string, limit: number) {
    return bindClientFunc({
        clientFunc: Client4.getAccessControlFields,
        params: [
            after,
            limit,
        ],
    });
}

export function updateAccessControlPolicyActive(policyId: string, active: boolean) {
    return bindClientFunc({
        clientFunc: Client4.updateAccessControlPolicyActive,
        params: [
            policyId,
            active,
        ],
    });
}
