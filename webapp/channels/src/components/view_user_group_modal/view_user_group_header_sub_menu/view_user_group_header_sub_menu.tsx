// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';

import type {Group} from '@mattermost/types/groups';

import type {ActionResult} from 'mattermost-redux/types/actions';

import * as Menu from 'components/menu';
import UpdateUserGroupModal from 'components/update_user_group_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {ModalData} from 'types/actions';

export type Props = {
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

const ViewUserGroupHeaderSubMenu = (props: Props) => {
    const {
        group,
        isGroupMember,
        currentUserId,
        decrementMemberCount,
        incrementMemberCount,
        backButtonCallback,
        backButtonAction,
        onExited,
        actions,
    } = props;

    const goToEditGroupModal = useCallback(() => {
        actions.openModal({
            modalId: ModalIdentifiers.EDIT_GROUP_MODAL,
            dialogType: UpdateUserGroupModal,
            dialogProps: {
                groupId: group.id,
                backButtonCallback: backButtonAction,
            },
        });
        onExited();
    }, [actions.openModal, group.id, backButtonAction, onExited]);

    const leaveGroup = useCallback(async () => {
        await actions.removeUsersFromGroup(group.id, [currentUserId]).then(() => {
            decrementMemberCount();
        });
    }, [group.id, actions.removeUsersFromGroup, decrementMemberCount, currentUserId]);

    const joinGroup = useCallback(async () => {
        await actions.addUsersToGroup(group.id, [currentUserId]).then(() => {
            incrementMemberCount();
        });
    }, [group.id, actions.addUsersToGroup, incrementMemberCount, currentUserId]);

    const archiveGroup = useCallback(async () => {
        await actions.archiveGroup(group.id).then(() => {
            backButtonCallback();
            onExited();
        });
    }, [group.id, actions.archiveGroup, backButtonCallback, onExited]);

    const {formatMessage} = useIntl();

    return (
        <div className='details-action'>
            <Menu.Container
                menuButton={{
                    id: `detailsCustomWrapper-${group.id}`,
                    class: 'btn btn-icon',
                    children: (<i className='icon icon-dots-vertical'/>),
                    'aria-label': formatMessage({id: 'view_user_group_header_sub_menu.menuAriaLabel', defaultMessage: 'User group actions'}),
                }}
                menu={{
                    id: 'details-group-actions-menu',
                    'aria-labelledby': `detailsCustomWrapper-${group.id}`,
                    className: 'group-actions-menu',
                }}
            >
                {props.permissionToEditGroup && (
                    <Menu.Item
                        id='edit-details'
                        onClick={goToEditGroupModal}
                        labels={
                            <FormattedMessage
                                id='user_groups_modal.editDetails'
                                defaultMessage='Edit Details'
                            />
                        }
                    />
                )}
                {props.permissionToJoinGroup && !isGroupMember && (
                    <Menu.Item
                        id='join-group'
                        onClick={joinGroup}
                        labels={
                            <FormattedMessage
                                id='user_groups_modal.joinGroup'
                                defaultMessage='Join Group'
                            />
                        }
                    />
                )}
                {props.permissionToLeaveGroup && isGroupMember && (
                    <Menu.Item
                        id='leave-group'
                        onClick={leaveGroup}
                        labels={
                            <FormattedMessage
                                id='user_groups_modal.leaveGroup'
                                defaultMessage='Leave Group'
                            />
                        }
                        isDestructive={true}
                    />
                )}
                {props.permissionToArchiveGroup && (
                    <Menu.Item
                        id='archive-group'
                        onClick={archiveGroup}
                        labels={
                            <FormattedMessage
                                id='user_groups_modal.archiveGroup'
                                defaultMessage='Archive Group'
                            />
                        }
                        isDestructive={true}
                    />
                )}
            </Menu.Container>
        </div>
    );
};

export default React.memo(ViewUserGroupHeaderSubMenu);
