// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {ModalData} from 'types/actions';
import LocalizedIcon from 'components/localized_icon';
import {t} from 'utils/i18n';
import {Group} from '@mattermost/types/groups';
import {ModalIdentifiers} from 'utils/constants';
import AddUsersToGroupModal from 'components/add_users_to_group_modal';
import ViewUserGroupHeaderSubMenu from '../view_user_group_header_sub_menu';
import {ActionResult} from 'mattermost-redux/types/actions';

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
    currentUserId: string;
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

const ViewUserGroupModalHeader = (props: Props) => {
    const goToAddPeopleModal = () => {
        const {actions, groupId} = props;

        actions.openModal({
            modalId: ModalIdentifiers.ADD_USERS_TO_GROUP,
            dialogType: AddUsersToGroupModal,
            dialogProps: {
                groupId,
                backButtonCallback: props.backButtonAction,
            },
        });
        props.onExited();
    };

    const restoreGroup = async () => {
        const {actions, groupId} = props;

        await actions.restoreGroup(groupId);
    };

    const showSubMenu = () => {
        const {permissionToEditGroup, permissionToJoinGroup, permissionToLeaveGroup, permissionToArchiveGroup} = props;

        return permissionToEditGroup ||
                permissionToJoinGroup ||
                permissionToLeaveGroup ||
                permissionToArchiveGroup
    };

    const modalTitle = () => {
        const {group} = props;

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
    };

    const addPeopleButton = () => {
        const {permissionToJoinGroup} = props;

        if (permissionToJoinGroup) {
            return (
                <button
                    className='user-groups-create btn btn-md btn-primary'
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
    };

    const restoreGroupButton = () => {
        const {permissionToRestoreGroup} = props;

        if (permissionToRestoreGroup) {
            return (
                <button
                    className='user-groups-create btn btn-md btn-primary'
                    onClick={restoreGroup}
                >
                    <FormattedMessage
                        id='user_groups_modal.restoreGroup'
                        defaultMessage='Restore group'
                    />
                </button>
            );
        }
        return (<></>);
    };

    const subMenuButton = () => {
        const {group} = props;

        if (group && showSubMenu()) {
            return (
                <ViewUserGroupHeaderSubMenu
                    group={group}
                    isGroupMember={props.isGroupMember}
                    decrementMemberCount={props.decrementMemberCount}
                    incrementMemberCount={props.incrementMemberCount}
                    backButtonCallback={props.backButtonCallback}
                    backButtonAction={props.backButtonAction}
                    onExited={props.onExited}
                    permissionToEditGroup={props.permissionToEditGroup}
                    permissionToJoinGroup={props.permissionToJoinGroup}
                    permissionToLeaveGroup={props.permissionToLeaveGroup}
                    permissionToArchiveGroup={props.permissionToArchiveGroup}
                />
            );
        }
        return null;
    };

    return (
        <Modal.Header closeButton={true}>
            <button
                type='button'
                className='modal-header-back-button btn-icon'
                aria-label='Close'
                onClick={() => {
                    props.backButtonCallback();
                    props.onExited();
                }}
            >
                <LocalizedIcon
                    className='icon icon-arrow-left'
                    ariaLabel={{id: t('user_groups_modal.goBackLabel'), defaultMessage: 'Back'}}
                />
            </button>
            {modalTitle()}
            {addPeopleButton()}
            {restoreGroupButton()}
            {subMenuButton()}
        </Modal.Header>
    );
};

export default React.memo(ViewUserGroupModalHeader);
