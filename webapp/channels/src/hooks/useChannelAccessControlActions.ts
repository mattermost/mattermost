// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useDispatch} from 'react-redux';

import type {AccessControlVisualAST, AccessControlTestResult, AccessControlPolicy} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';

import {
    getAccessControlFields,
    getVisualAST,
    searchUsersForExpression,
    getAccessControlPolicy,
    createAccessControlPolicy,
} from 'mattermost-redux/actions/access_control';
import type {ActionResult} from 'mattermost-redux/types/actions';

export interface ChannelAccessControlActions {
    getAccessControlFields: (after: string, limit: number) => Promise<ActionResult<UserPropertyField[]>>;
    getVisualAST: (expression: string) => Promise<ActionResult<AccessControlVisualAST>>;
    searchUsers: (expression: string, term: string, after: string, limit: number) => Promise<ActionResult<AccessControlTestResult>>;
    getChannelPolicy: (channelId: string) => Promise<ActionResult<AccessControlPolicy>>;
    saveChannelPolicy: (policy: AccessControlPolicy) => Promise<ActionResult<AccessControlPolicy>>;
}

/**
 * Hook that provides access control actions for both System Console and Channel Settings contexts.
 * This is a thin wrapper around the existing redux actions that provides:
 * - Consistent interface for both system and channel contexts
 * - Future extensibility for channel-specific logic (This is the main reason for this hook)
 * - Simplified usage in components without needing to import redux actions directly
 * - Improved readability and maintainability of components
 * - Easier testing and mocking in unit tests
 * - Centralized access control logic for easier updates and changes
 * - Single source of truth for ABAC actions for the channel context
 *
 * @param channelId - Optional channel ID for channel-specific context (used for future enhancements)
 * @returns Object containing access control action functions
 */
export const useChannelAccessControlActions = (): ChannelAccessControlActions => { // eventually accept channelId for future use in channel-specific logic
    const dispatch = useDispatch();

    return useMemo(() => ({

        /**
         * Get available user attribute fields for access control rules
         */
        getAccessControlFields: (after: string, limit: number) => {
            return dispatch(getAccessControlFields(after, limit));
        },

        /**
         * Convert a CEL expression to a visual AST for table editor display
         */
        getVisualAST: (expression: string) => {
            return dispatch(getVisualAST(expression));
        },

        /**
         * Search users that match a given access control expression
         */
        searchUsers: (expression: string, term: string, after: string, limit: number) => {
            return dispatch(searchUsersForExpression(expression, term, after, limit));
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
    }), [dispatch]);
};

export default useChannelAccessControlActions;
