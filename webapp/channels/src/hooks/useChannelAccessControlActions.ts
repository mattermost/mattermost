// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useDispatch} from 'react-redux';

import type {AccessControlVisualAST, AccessControlTestResult, AccessControlPolicy, AccessControlPolicyActiveUpdate} from '@mattermost/types/access_control';
import type {ChannelMembership} from '@mattermost/types/channels';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties';

import {
    getAccessControlFields,
    getVisualAST,
    searchUsersForExpression,
    getAccessControlPolicy,
    createAccessControlPolicy,
    deleteAccessControlPolicy,
    validateExpressionAgainstRequester,
    createAccessControlSyncJob,
    updateAccessControlPoliciesActive,
} from 'mattermost-redux/actions/access_control';
import {getChannelMembers} from 'mattermost-redux/actions/channels';
import {createJob} from 'mattermost-redux/actions/jobs';
import type {ActionResult} from 'mattermost-redux/types/actions';

export interface ChannelAccessControlActions {
    getAccessControlFields: (after: string, limit: number) => Promise<ActionResult<UserPropertyField[]>>;
    getVisualAST: (expression: string) => Promise<ActionResult<AccessControlVisualAST>>;
    searchUsers: (expression: string, term: string, after: string, limit: number) => Promise<ActionResult<AccessControlTestResult>>;
    getChannelPolicy: (channelId: string) => Promise<ActionResult<AccessControlPolicy>>;
    saveChannelPolicy: (policy: AccessControlPolicy) => Promise<ActionResult<AccessControlPolicy>>;
    deleteChannelPolicy: (policyId: string) => Promise<ActionResult>;
    getChannelMembers: (channelId: string, page?: number, perPage?: number) => Promise<ActionResult<ChannelMembership[]>>;
    createJob: (job: JobTypeBase & { data: any }) => Promise<ActionResult>;
    updateAccessControlPoliciesActive: (statuses: AccessControlPolicyActiveUpdate[]) => Promise<ActionResult>;
    validateExpressionAgainstRequester: (expression: string) => Promise<ActionResult<{requester_matches: boolean}>>;
    createAccessControlSyncJob: (jobData: {policy_id?: string; team_id?: string}) => Promise<ActionResult>;
}

/**
 * Provides ABAC actions scoped to channel or team context.
 * Injects channelId/teamId into all API calls for permission verification.
 * @param channelId - Optional channel ID for channel-specific context. Required for channel admin contexts, optional for system admin contexts.
 * @returns Object containing access control action functions
 */
export const useChannelAccessControlActions = (channelId?: string, teamId?: string): ChannelAccessControlActions => {
    const dispatch = useDispatch();

    return useMemo(() => ({
        getAccessControlFields: (after: string, limit: number) => {
            return dispatch(getAccessControlFields(after, limit, channelId, teamId));
        },

        getVisualAST: (expression: string) => {
            return dispatch(getVisualAST(expression, channelId, teamId));
        },

        searchUsers: (expression: string, term: string, after: string, limit: number) => {
            return dispatch(searchUsersForExpression(expression, term, after, limit, channelId, teamId));
        },

        getChannelPolicy: (channelId: string) => {
            return dispatch(getAccessControlPolicy(channelId));
        },

        saveChannelPolicy: (policy: AccessControlPolicy) => {
            return dispatch(createAccessControlPolicy(policy, teamId));
        },

        deleteChannelPolicy: (policyId: string) => {
            return dispatch(deleteAccessControlPolicy(policyId, teamId));
        },

        getChannelMembers: (channelId: string, page = 0, perPage = 200) => {
            return dispatch(getChannelMembers(channelId, page, perPage));
        },

        createJob: (job: JobTypeBase & { data: any }) => {
            return dispatch(createJob(job));
        },

        validateExpressionAgainstRequester: (expression: string) => {
            return dispatch(validateExpressionAgainstRequester(expression, channelId, teamId));
        },

        createAccessControlSyncJob: (jobData: {policy_id?: string; team_id?: string}) => {
            return dispatch(createAccessControlSyncJob(jobData));
        },

        updateAccessControlPoliciesActive: (statuses: AccessControlPolicyActiveUpdate[]) => {
            return dispatch(updateAccessControlPoliciesActive(statuses, teamId));
        },
    }), [dispatch, channelId, teamId]);
};

export default useChannelAccessControlActions;
