// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {GlobalState} from '@mattermost/types/store';

import {PlaybookRunType, RunStatus} from 'src/graphql/generated/graphql';
import {PlaybookRun} from 'src/types/playbook_run';

import {useHasChannelPermission} from './permissions';

type RunPermissionsScope = Pick<PlaybookRun, 'type' | 'team_id' | 'channel_id' | 'owner_user_id' | 'participant_ids' | 'current_status'>;

/**
 * Minimal run fields needed for permission checks
 * Accepts both PlaybookRunStatus and RunStatus (GraphQL enum) for current_status
 */
export type RunPermissionFields = RunPermissionsScope & Partial<PlaybookRun>;

/**
 * Check if a channel is archived
 */
const useIsChannelArchived = (channelId: string): boolean => {
    return useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return channel ? channel.delete_at > 0 : false;
    });
};

/**
 * Check if user can view a run based on its type
 * - For channelChecklists: requires channel read permission
 * - For playbook runs: handled by existing playbook permissions
 */
export const useCanViewRun = (run: RunPermissionFields | null | undefined): boolean => {
    const hasChannelReadPermission = useHasChannelPermission(
        run?.team_id || '',
        run?.channel_id || '',
        'read_channel'
    );

    if (!run) {
        return false;
    }

    // For channelChecklists, use channel-based permissions
    if (run.type === PlaybookRunType.ChannelChecklist) {
        return hasChannelReadPermission;
    }

    // For playbook runs, the backend handles permissions via playbook membership
    // If the run was returned from the API, the user has permission to view it
    return true;
};

/**
 * Internal helper to check permissions without status check
 */
const useHasModifyPermissions = (run: RunPermissionFields | null | undefined, currentUserId: string): boolean => {
    const hasChannelPostPermission = useHasChannelPermission(
        run?.team_id || '',
        run?.channel_id || '',
        'create_post'
    );
    const isChannelArchived = useIsChannelArchived(run?.channel_id || '');

    if (!run) {
        return false;
    }

    // For channelChecklists, use channel-based permissions
    if (run.type === PlaybookRunType.ChannelChecklist) {
        // Cannot modify if channel is archived
        if (isChannelArchived) {
            return false;
        }

        // Allow modification if user can post in channel OR is the owner
        return hasChannelPostPermission || run.owner_user_id === currentUserId;
    }

    // For playbook runs, check if user is owner or participant
    return run.owner_user_id === currentUserId ||
           run.participant_ids.includes(currentUserId);
};

/**
 * Check if user can modify a run based on its type and status
 * - Cannot modify if run is finished
 * - For channelChecklists: requires channel post permission AND channel must not be archived
 * - For playbook runs: requires owner or participant status
 */
export const useCanModifyRun = (run: RunPermissionFields | null | undefined, currentUserId: string): boolean => {
    const hasPermissions = useHasModifyPermissions(run, currentUserId);

    if (!run || !hasPermissions) {
        return false;
    }

    // Cannot modify finished runs (compare string values to handle both enum types)
    return run.current_status !== RunStatus.Finished;
};

/**
 * Check if user has permissions to restore/resume a finished run
 * Same as modify permissions but ignores run status
 */
export const useCanRestoreRun = (run: RunPermissionFields | null | undefined, currentUserId: string): boolean => {
    return useHasModifyPermissions(run, currentUserId);
};

/**
 * Check if user can manage properties of a run (same as modify for now)
 */
export const useCanManageRunProperties = (run: RunPermissionFields | null | undefined, currentUserId: string): boolean => {
    return useCanModifyRun(run, currentUserId);
};

/**
 * Check if user can delete/admin a run
 * - For channelChecklists: requires channel management permission OR ownership AND channel must not be archived
 * - For playbook runs: requires ownership
 */
export const useCanAdminRun = (run: RunPermissionFields | null | undefined, currentUserId: string): boolean => {
    const hasChannelManagePermission = useHasChannelPermission(
        run?.team_id || '',
        run?.channel_id || '',
        'manage_public_channel_properties' // Will check both public and private variants
    );
    const isChannelArchived = useIsChannelArchived(run?.channel_id || '');

    if (!run) {
        return false;
    }

    // For channelChecklists, use channel management permissions or ownership
    if (run.type === PlaybookRunType.ChannelChecklist) {
        // Cannot admin if channel is archived
        if (isChannelArchived) {
            return false;
        }
        return hasChannelManagePermission || run.owner_user_id === currentUserId;
    }

    // For playbook runs, only owner or admin can delete
    return run.owner_user_id === currentUserId;
};

/**
 * Helper to check if a run is a channelChecklist
 */
export const isChannelChecklist = (run: Pick<PlaybookRun, 'type'> | null | undefined): boolean => {
    return run?.type === PlaybookRunType.ChannelChecklist;
};

/**
 * Helper to check if a run is a playbook-based run
 */
export const isPlaybookRun = (run: Pick<PlaybookRun, 'type'> | null | undefined): boolean => {
    return run?.type === PlaybookRunType.Playbook;
};
