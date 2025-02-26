// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

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
}

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

    const modalTitle = useCallback(() => {
        if (group) {
            return (
                <Modal.Title
                    componentClass='h1'
                    id='userGroupsModalLabel'
                >
                    {group.display_name}
                    {
                        group.delete_at > 0 &&
                        <i className='icon icon-archive-outline'/>
                    }
                </Modal.Title>
            );
        }
        return (<></>);
    }, [group]);

    const addPeopleButton = useCallback(() => {
        if (permissionToJoinGroup) {
            return (
                <button
                    className='mr-2 btn btn-secondary btn-sm'
                    onClick={goToAddPeopleModal}
                >
                    <FormattedMessage
                        id='user_groups_modal.addPeople'
                        defaultMessage='Add people'
                    />
                </button>
            );
        }
        return (<></>);
    }, [permissionToJoinGroup, goToAddPeopleModal]);

    const restoreGroupButton = useCallback(() => {
        if (permissionToRestoreGroup) {
            return (
                <button
                    className='user-groups-create btn btn-md btn-primary'
                    onClick={restoreGroup}
                >
                    <FormattedMessage
                        id='user_groups_modal.button.restoreGroup'
                        defaultMessage='Restore Group'
                    />
                </button>
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
        <Modal.Header closeButton={true}>
            <div className='d-flex align-items-center'>
                <button
                    type='button'
                    className='modal-header-back-button btn btn-icon'
                    aria-label={formatMessage({id: 'user_groups_modal.goBackLabel', defaultMessage: 'Back'})}
                    onClick={goBack}
                >
                    <i
                        className='icon icon-arrow-left'
                    />
                </button>
                {modalTitle()}
            </div>
            <div className='d-flex align-items-center'>
                {addPeopleButton()}
                {restoreGroupButton()}
                {subMenuButton()}
            </div>
        </Modal.Header>
    );
};

export default React.memo(ViewUserGroupModalHeader);
