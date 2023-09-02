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
    isGroupMember: boolean;
    currentUserId: string;
    incrementMemberCount: () => void;
    decrementMemberCount: () => void;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        removeUsersFromGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
        addUsersToGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
        archiveGroup: (groupId: string) => Promise<ActionResult>;
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

    const showSubMenu = (source: string) => {
        const {permissionToEditGroup, permissionToJoinGroup, permissionToLeaveGroup, permissionToArchiveGroup} = props;

        return source.toLowerCase() !== 'ldap' &&
            (
                permissionToEditGroup ||
                permissionToJoinGroup ||
                permissionToLeaveGroup ||
                permissionToArchiveGroup
            );
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
                </Modal.Title>
            );
        }
        return (<></>);
    };

    const addPeopleButton = () => {
        const {group, permissionToJoinGroup} = props;

        if (group?.source.toLowerCase() !== 'ldap' && permissionToJoinGroup) {
            return (
                <button
                    className='mr-2 btn btn-secondary'
                    onClick={goToAddPeopleModal}
                >
                    <FormattedMessage
                        id='user_groups_modal.addPeople'
                        defaultMessage='Add People'
                    />
                </button>
            );
        }
        return (<></>);
    };

    const subMenuButton = () => {
        const {group} = props;

        if (group && showSubMenu(group?.source)) {
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
            {subMenuButton()}
        </Modal.Header>
    );
};

export default React.memo(ViewUserGroupModalHeader);
