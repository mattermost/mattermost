// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useDispatch} from 'react-redux';

import type {AccessControlVisualAST, AccessControlTestResult, AccessControlPolicy} from '@mattermost/types/access_control';
import type {ChannelMembership} from '@mattermost/types/channels';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties';

import {
    getAccessControlFields,
    getVisualAST,
    searchUsersForExpression,
    getAccessControlPolicy,
    createAccessControlPolicy,
    updateAccessControlPolicyActive,
    deleteAccessControlPolicy,
    validateExpressionAgainstRequester,
    createAccessControlSyncJob,
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
    updateAccessControlPolicyActive: (policyId: string, active: boolean) => Promise<ActionResult>;
    validateExpressionAgainstRequester: (expression: string) => Promise<ActionResult<{requester_matches: boolean}>>;
    createAccessControlSyncJob: (jobData: {policy_id: string}) => Promise<ActionResult>;
}

/**
 * Hook that provides access control actions for both System Console and Channel Settings contexts.
 * This is a thin wrapper around the existing redux actions that provides:
 * - Consistent interface for both system and channel contexts
 * - Channel-specific security for channel admin contexts
 * - Simplified usage in components without needing to import redux actions directly
 * - Improved readability and maintainability of components
 * - Easier testing and mocking in unit tests
 * - Centralized access control logic for easier updates and changes
 * - Single source of truth for ABAC actions for the channel context
 *
 * @param channelId - Optional channel ID for channel-specific context. Required for channel admin contexts, optional for system admin contexts.
 * @returns Object containing access control action functions
 */
export const useChannelAccessControlActions = (channelId?: string): ChannelAccessControlActions => {
    const dispatch = useDispatch();

    return useMemo(() => ({

        /**
         * Get available user attribute fields for access control rules
         */
        getAccessControlFields: (after: string, limit: number) => {
            return dispatch(getAccessControlFields(after, limit, channelId));
        },

        /**
         * Convert a CEL expression to a visual AST for table editor display
         */
        getVisualAST: (expression: string) => {
            return dispatch(getVisualAST(expression, channelId));
        },

        /**
         * Search users that match a given access control expression
         */
        searchUsers: (expression: string, term: string, after: string, limit: number) => {
            return dispatch(searchUsersForExpression(expression, term, after, limit, channelId));
        },

        /**
         * Get the access control policy for a specific channel
         */
        getChannelPolicy: (channelId: string) => {
            return dispatch(getAccessControlPolicy(channelId));
        },

        /**
         * Save or update the access control policy for a channel
         */
        saveChannelPolicy: (policy: AccessControlPolicy) => {
            return dispatch(createAccessControlPolicy(policy));
        },

        /**
         * Delete the access control policy for a channel
         */
        deleteChannelPolicy: (policyId: string) => {
            return dispatch(deleteAccessControlPolicy(policyId));
        },

        /**
         * Get channel members for a specific channel
         */
        getChannelMembers: (channelId: string, page = 0, perPage = 200) => {
            return dispatch(getChannelMembers(channelId, page, perPage));
        },

        /**
         * Create a job for access control synchronization
         */
        createJob: (job: JobTypeBase & { data: any }) => {
            return dispatch(createJob(job));
        },

        /**
         * Update the active status of an access control policy
         */
        updateAccessControlPolicyActive: (policyId: string, active: boolean) => {
            return dispatch(updateAccessControlPolicyActive(policyId, active));
        },

        /**
         * Validate if the current user (requester) matches an access control expression
         */
        validateExpressionAgainstRequester: (expression: string) => {
            return dispatch(validateExpressionAgainstRequester(expression, channelId));
        },

        /**
         * Create an access control sync job with deduplication
         */
        createAccessControlSyncJob: (jobData: {policy_id: string}) => {
            return dispatch(createAccessControlSyncJob(jobData));
        },
    }), [dispatch, channelId]);
};

export default useChannelAccessControlActions;
