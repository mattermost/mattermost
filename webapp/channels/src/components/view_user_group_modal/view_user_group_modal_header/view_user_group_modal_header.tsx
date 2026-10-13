// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    ArchiveOutlineIcon,
    ArrowLeftIcon,
    CloseIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import {GroupSource, PluginGroupSourcePrefix} from '@mattermost/types/groups';
import type {Group} from '@mattermost/types/groups';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AddUsersToGroupModal from 'components/add_users_to_group_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {ModalData} from 'types/actions';

import ViewUserGroupHeaderSubMenu from '../view_user_group_header_sub_menu';

export type Props = {
    groupId: string;
    group: Group;
    onExited: () => void;
    backButtonCallback: () => void;
    backButtonAction: () => void;
    permissionToEditGroup: boolean;
    permissionToJoinGroup: boolean;
    permissionToLeaveGroup: boolean;
    permissionToArchiveGroup: boolean;
    permissionToRestoreGroup: boolean;
    isGroupMember: boolean;
    incrementMemberCount: () => void;
    decrementMemberCount: () => void;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        removeUsersFromGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
        addUsersToGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
        archiveGroup: (groupId: string) => Promise<ActionResult>;
        restoreGroup: (groupId: string) => Promise<ActionResult>;
    };
};

const ViewUserGroupModalHeader = ({
    groupId,
    group,
    onExited,
    backButtonCallback,
    backButtonAction,
    permissionToEditGroup,
    permissionToJoinGroup,
    permissionToLeaveGroup,
    permissionToArchiveGroup,
    permissionToRestoreGroup,
    isGroupMember,
    incrementMemberCount,
    decrementMemberCount,
    actions,
}: Props) => {
    const {formatMessage} = useIntl();

    const goToAddPeopleModal = useCallback(() => {
        actions.openModal({
            modalId: ModalIdentifiers.ADD_USERS_TO_GROUP,
            dialogType: AddUsersToGroupModal,
            dialogProps: {
                groupId,
                backButtonCallback: backButtonAction,
            },
        });
        onExited();
    }, [actions.openModal, groupId, onExited, backButtonAction]);

    const restoreGroup = useCallback(async () => {
        await actions.restoreGroup(groupId);
    }, [actions.restoreGroup, groupId]);

    const showSubMenu = useCallback(() => {
        return permissionToEditGroup ||
                permissionToJoinGroup ||
                permissionToLeaveGroup ||
                permissionToArchiveGroup;
    }, [permissionToEditGroup, permissionToJoinGroup, permissionToLeaveGroup, permissionToArchiveGroup]);

    const groupSubtitle = useCallback(() => {
        if (!group) {
            return null;
        }

        return (
            <div className='user-groups-modal__header-subtitle'>
                <span className='group-name'>{`@${group.name}`}</span>
                {
                    group.source.toLowerCase() === GroupSource.Ldap &&
                    <span className='group-source'>
                        <FormattedMessage
                            id='view_user_group_modal.ldapSynced'
                            defaultMessage='AD/LDAP SYNCED'
                        />
                    </span>
                }
                {
                    group.source.toLowerCase().startsWith(PluginGroupSourcePrefix.Plugin) &&
                    <span className='group-source'>
                        <FormattedMessage
                            id='view_user_group_modal.pluginSynced'
                            defaultMessage='Plugin SYNCED'
                        />
                    </span>
                }
            </div>
        );
    }, [group]);

    const modalTitle = useCallback(() => {
        if (group) {
            return (
                <div className='user-groups-modal__header-title-block'>
                    <Modal.Title
                        componentClass='h1'
                        id='viewUserGroupModalLabel'
                    >
                        {group.display_name}
                        {
                            group.delete_at > 0 &&
                            <ArchiveOutlineIcon size={18}/>
                        }
                    </Modal.Title>
                    {groupSubtitle()}
                </div>
            );
        }
        return (<></>);
    }, [group, groupSubtitle]);

    const addPeopleButton = useCallback(() => {
        if (permissionToJoinGroup) {
            return (
                <Button
                    emphasis='secondary'
                    size='sm'
                    onClick={goToAddPeopleModal}
                >
                    <FormattedMessage
                        id='user_groups_modal.addPeople'
                        defaultMessage='Add people'
                    />
                </Button>
            );
        }
        return (<></>);
    }, [permissionToJoinGroup, goToAddPeopleModal]);

    const restoreGroupButton = useCallback(() => {
        if (permissionToRestoreGroup) {
            return (
                <Button
                    emphasis='secondary'
                    size='sm'
                    onClick={restoreGroup}
                >
                    <FormattedMessage
                        id='user_groups_modal.button.restoreGroup'
                        defaultMessage='Restore Group'
                    />
                </Button>
            );
        }
        return (<></>);
    }, [permissionToRestoreGroup, restoreGroup]);

    const subMenuButton = () => {
        if (group && showSubMenu()) {
            return (
                <ViewUserGroupHeaderSubMenu
                    group={group}
                    isGroupMember={isGroupMember}
                    decrementMemberCount={decrementMemberCount}
                    incrementMemberCount={incrementMemberCount}
                    backButtonCallback={backButtonCallback}
                    backButtonAction={backButtonAction}
                    onExited={onExited}
                    permissionToEditGroup={permissionToEditGroup}
                    permissionToJoinGroup={permissionToJoinGroup}
                    permissionToLeaveGroup={permissionToLeaveGroup}
                    permissionToArchiveGroup={permissionToArchiveGroup}
                />
            );
        }
        return null;
    };

    const goBack = useCallback(() => {
        backButtonCallback();
        onExited();
    }, [backButtonCallback, onExited]);

    return (
        <Modal.Header closeButton={false}>
            <WithTooltip title={formatMessage({id: 'user_groups_modal.goBackLabel', defaultMessage: 'Back'})}>
                <IconButton
                    size='medium'
                    className='modal-header-back-button'
                    icon={<Icon glyph={<ArrowLeftIcon/>}/>}
                    aria-label={formatMessage({id: 'user_groups_modal.goBackLabel', defaultMessage: 'Back'})}
                    onClick={goBack}
                />
            </WithTooltip>
            {modalTitle()}
            <div className='user-groups-modal__header-actions d-flex align-items-center'>
                {addPeopleButton()}
                {restoreGroupButton()}
                {subMenuButton()}
                <WithTooltip title={formatMessage({id: 'generic.close', defaultMessage: 'Close'})}>
                    <IconButton
                        className='user-groups-modal__header-close'
                        size='medium'
                        icon={<Icon glyph={<CloseIcon/>}/>}
                        onClick={onExited}
                        aria-label={formatMessage({id: 'generic.close', defaultMessage: 'Close'})}
                    />
                </WithTooltip>
            </div>
        </Modal.Header>
    );
};

export default React.memo(ViewUserGroupModalHeader);
