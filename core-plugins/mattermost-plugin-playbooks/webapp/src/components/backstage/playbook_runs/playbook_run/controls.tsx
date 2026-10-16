// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ArrowDownIcon,
    BookOutlineIcon,
    BullhornOutlineIcon,
    CloseIcon,
    FlagOutlineIcon,
    LightningBoltOutlineIcon,
    LinkVariantIcon,
    PencilOutlineIcon,
    StarIcon,
    StarOutlineIcon,
    UpdateIcon,
} from '@mattermost/compass-icons/components';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {exportChannelUrl, getSiteUrl} from 'src/client';
import {useAllowChannelExport, useExportLogAvailable, usePlaybooksRouting} from 'src/hooks';
import {PlaybookRun, playbookRunIsActive} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {copyToClipboard} from 'src/utils';

import {StyledDropdownMenuItem, StyledDropdownMenuItemRed} from 'src/components/backstage/shared';
import {useToaster} from 'src/components/backstage/toast_banner';
import {Role, Separator} from 'src/components/backstage/playbook_runs/shared';
import {RunPermissionFields, useCanModifyRun, useCanRestoreRun} from 'src/hooks/run_permissions';
import {ChecklistItemState, newChecklistItem} from 'src/types/playbook';

import {useToggleRunStatusUpdate} from './enable_disable_run_status_update';

import {useOnFinishRun} from './finish_run';
import {useOnRestoreRun} from './restore_run';

export const FavoriteRunMenuItem = (props: {isFavoriteRun: boolean, toggleFavorite: () => void}) => {
    return (
        <StyledDropdownMenuItem onClick={props.toggleFavorite}>
            {props.isFavoriteRun ? (
                <>
                    <StarOutlineIcon size={18}/>
                    <FormattedMessage defaultMessage='Unfavorite'/>
                </>
            ) : (
                <>
                    <StarIcon size={18}/>
                    <FormattedMessage defaultMessage='Favorite'/>
                </>
            )}
        </StyledDropdownMenuItem>
    );
};

export const CopyRunLinkMenuItem = (props: {playbookRunId: string}) => {
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();

    return (
        <StyledDropdownMenuItem
            onClick={() => {
                copyToClipboard(getSiteUrl() + '/playbooks/runs/' + props.playbookRunId);
                addToast({content: formatMessage({defaultMessage: 'Copied!'})});
            }}
        >
            <LinkVariantIcon size={18}/>
            <FormattedMessage defaultMessage='Copy link'/>
        </StyledDropdownMenuItem>
    );
};

export const RenameRunItem = (props: {onClick: () => void, playbookRun: PlaybookRun, role: Role}) => {
    const currentUserId = useSelector(getCurrentUserId);

    // Create a minimal run object with only the fields needed for permission checking
    const runForPermissions: RunPermissionFields = {
        type: props.playbookRun.type,
        channel_id: props.playbookRun.channel_id,
        team_id: props.playbookRun.team_id,
        owner_user_id: props.playbookRun.owner_user_id,
        participant_ids: props.playbookRun.participant_ids,
        current_status: props.playbookRun.current_status,
    };

    const canModify = useCanModifyRun(runForPermissions, currentUserId);

    if (canModify) {
        return (
            <StyledDropdownMenuItem
                onClick={props.onClick}
            >
                <PencilOutlineIcon size={18}/>
                <FormattedMessage defaultMessage='Rename'/>
            </StyledDropdownMenuItem>
        );
    }
    return null;
};

export const FollowRunMenuItem = (props: {isFollowing: boolean, toggleFollow: () => void}) => {
    return (
        <StyledDropdownMenuItem
            onClick={props.toggleFollow}
        >
            <BullhornOutlineIcon size={18}/>
            {props.isFollowing ? <FormattedMessage defaultMessage='Unfollow'/> : <FormattedMessage defaultMessage='Follow'/>}
        </StyledDropdownMenuItem>
    );
};

export const LeaveRunMenuItem = (props: {isFollowing: boolean, role: Role, showLeaveRunConfirm: () => void}) => {
    const isFollowing = props.isFollowing;

    if (props.role === Role.Participant) {
        return (
            <>
                <Separator/>
                <StyledDropdownMenuItemRed onClick={props.showLeaveRunConfirm}>
                    <CloseIcon size={18}/>
                    <FormattedMessage
                        defaultMessage='Leave{isFollowing, select, true { and unfollow} other {}}'
                        values={{isFollowing}}
                    />
                </StyledDropdownMenuItemRed>
            </>
        );
    }

    return null;
};

export const RunActionsMenuItem = (props: {onClick: () => void, playbookRun: PlaybookRun, role: Role}) => {
    const currentUserId = useSelector(getCurrentUserId);

    // Create a minimal run object with only the fields needed for permission checking
    const runForPermissions: RunPermissionFields = {
        type: props.playbookRun.type,
        channel_id: props.playbookRun.channel_id,
        team_id: props.playbookRun.team_id,
        owner_user_id: props.playbookRun.owner_user_id,
        participant_ids: props.playbookRun.participant_ids,
        current_status: props.playbookRun.current_status,
    };

    const canModify = useCanModifyRun(runForPermissions, currentUserId);

    if (canModify) {
        return (
            <StyledDropdownMenuItem
                onClick={props.onClick}
            >
                <LightningBoltOutlineIcon size={18}/>
                <FormattedMessage defaultMessage='Actions'/>
            </StyledDropdownMenuItem>
        );
    }

    return null;
};

export const ExportLogsMenuItem = (props: {exportAvailable: boolean, onExportClick: () => void}) => {
    const {formatMessage} = useIntl();

    return (
        <StyledDropdownMenuItem
            disabled={!props.exportAvailable}
            disabledAltText={formatMessage({defaultMessage: 'Install and enable the Channel Export plugin to support exporting the channel'})}
            onClick={props.onExportClick}
        >
            <ArrowDownIcon size={18}/>
            <FormattedMessage defaultMessage='Export channel log'/>
        </StyledDropdownMenuItem>
    );
};

export const FinishRunMenuItem = (props: {playbookRun: PlaybookRun, role: Role, location?: string}) => {
    const onFinishRun = useOnFinishRun(props.playbookRun, props.location || 'backstage');
    const currentUserId = useSelector(getCurrentUserId);

    // Create a minimal run object with only the fields needed for permission checking
    const runForPermissions: RunPermissionFields = {
        type: props.playbookRun.type,
        channel_id: props.playbookRun.channel_id,
        team_id: props.playbookRun.team_id,
        owner_user_id: props.playbookRun.owner_user_id,
        participant_ids: props.playbookRun.participant_ids,
        current_status: props.playbookRun.current_status,
    };

    const canModify = useCanModifyRun(runForPermissions, currentUserId);

    if (canModify) {
        return (
            <>
                <Separator/>
                <StyledDropdownMenuItem
                    onClick={onFinishRun}
                >
                    <FlagOutlineIcon size={18}/>
                    <FormattedMessage defaultMessage='Finish'/>
                </StyledDropdownMenuItem>
            </>
        );
    }

    return null;
};

export const ExportChannelLogsMenuItem = (props: {channelId: string, setShowModal: (show: boolean) => void}) => {
    const exportAvailable = useExportLogAvailable();
    const allowChannelExport = useAllowChannelExport();

    const onExportClick = () => {
        if (!allowChannelExport) {
            props.setShowModal(true);
            return;
        }

        window.location.href = exportChannelUrl(props.channelId);
    };

    return (
        <ExportLogsMenuItem
            exportAvailable={exportAvailable}
            onExportClick={onExportClick}
        />
    );
};

export const RestoreRunMenuItem = (props: {playbookRun: PlaybookRun, role: Role, location?: string}) => {
    const onRestoreRun = useOnRestoreRun(props.playbookRun, props.location || 'backstage');
    const isChannelChecklist = props.playbookRun.type === PlaybookRunType.ChannelChecklist;
    const currentUserId = useSelector(getCurrentUserId);

    // Create a minimal run object with only the fields needed for permission checking
    const runForPermissions: RunPermissionFields = {
        type: props.playbookRun.type,
        channel_id: props.playbookRun.channel_id,
        team_id: props.playbookRun.team_id,
        owner_user_id: props.playbookRun.owner_user_id,
        participant_ids: props.playbookRun.participant_ids,
        current_status: props.playbookRun.current_status,
    };

    const canRestore = useCanRestoreRun(runForPermissions, currentUserId);

    if (!playbookRunIsActive(props.playbookRun) && canRestore) {
        return (
            <>
                <Separator/>
                <StyledDropdownMenuItem
                    onClick={onRestoreRun}
                    className='restartRun'
                >
                    <FlagOutlineIcon size={18}/>
                    {isChannelChecklist ? <FormattedMessage defaultMessage='Resume'/> : <FormattedMessage defaultMessage='Restart'/>}
                </StyledDropdownMenuItem>
            </>
        );
    }

    return null;
};

export const ToggleRunStatusUpdateMenuItem = (props: {playbookRun: PlaybookRun, role: Role}) => {
    const toggleRunStatusUpdates = useToggleRunStatusUpdate(props.playbookRun);
    const currentUserId = useSelector(getCurrentUserId);

    const statusUpdateEnabled = props.playbookRun.status_update_enabled;

    // Create a minimal run object with only the fields needed for permission checking
    const runForPermissions: RunPermissionFields = {
        type: props.playbookRun.type,
        channel_id: props.playbookRun.channel_id,
        team_id: props.playbookRun.team_id,
        owner_user_id: props.playbookRun.owner_user_id,
        participant_ids: props.playbookRun.participant_ids,
        current_status: props.playbookRun.current_status,
    };

    const canModify = useCanModifyRun(runForPermissions, currentUserId);

    return (
        <>
            { canModify &&
                <>
                    <Separator/>
                    <StyledDropdownMenuItem
                        onClick={() => toggleRunStatusUpdates(!statusUpdateEnabled)}
                    >
                        <UpdateIcon size={18}/>
                        {
                            statusUpdateEnabled ? <FormattedMessage defaultMessage={'Disable status updates'}/> : <FormattedMessage defaultMessage={'Enable status updates'}/>
                        }
                    </StyledDropdownMenuItem>
                </>
            }
        </>
    );
};

export const SaveAsPlaybookMenuItem = (props: {playbookRun: PlaybookRun}) => {
    const {formatMessage} = useIntl();
    const {create} = usePlaybooksRouting();

    const isChannelChecklist = props.playbookRun.type === PlaybookRunType.ChannelChecklist;

    const handleSaveAsPlaybook = () => {
        // Sanitize checklists by removing IDs and using newChecklistItem helper
        const sanitizedChecklists = props.playbookRun.checklists.map((checklist) => ({
            title: checklist.title,
            items: checklist.items.map((item) =>
                newChecklistItem(
                    item.title,
                    item.description,
                    item.command,
                    item.state as ChecklistItemState
                )
            ),
        }));

        // Always create public playbooks (can convert public -> private later, but not vice versa)
        // Navigate to create new playbook with the run's checklists as a template
        create({
            teamId: props.playbookRun.team_id,
            description: props.playbookRun.summary || formatMessage({defaultMessage: 'Created from "{runName}"'}, {runName: props.playbookRun.name}),
            public: true,
            name: props.playbookRun.name,
        }, {
            checklists: sanitizedChecklists,
        });
    };

    if (!isChannelChecklist) {
        return null;
    }

    return (
        <StyledDropdownMenuItem onClick={handleSaveAsPlaybook}>
            <BookOutlineIcon size={18}/>
            <FormattedMessage defaultMessage='Save as playbook'/>
        </StyledDropdownMenuItem>
    );
};
