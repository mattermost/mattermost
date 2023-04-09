// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import {ModalData} from 'types/actions';
import LocalizedIcon from 'components/localized_icon';
import {t} from 'utils/i18n';
import {Group} from '@mattermost/types/groups';
import {ModalIdentifiers} from 'utils/constants';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Menu from 'components/widgets/menu/menu';
import * as Utils from 'utils/utils';
import {ActionResult} from 'mattermost-redux/types/actions';
import UpdateUserGroupModal from 'components/update_user_group_modal';

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

    return (
        <div className='details-action'>
            <MenuWrapper
                isDisabled={false}
                stopPropagationOnToggle={false}
                id={`detailsCustomWrapper-${group.id}`}
            >
                <button className='action-wrapper btn-icon'>
                    <LocalizedIcon
                        className='icon icon-dots-vertical'
                        ariaLabel={{id: t('user_groups_modal.goBackLabel'), defaultMessage: 'Back'}}
                    />
                </button>
                <Menu
                    openLeft={false}
                    openUp={false}
                    ariaLabel={Utils.localizeMessage('admin.user_item.menuAriaLabel', 'User Actions Menu')}
                >
                    <Menu.ItemAction
                        show={props.permissionToEditGroup}
                        onClick={goToEditGroupModal}
                        text={Utils.localizeMessage('user_groups_modal.editDetails', 'Edit Details')}
                        disabled={false}
                    />
                    <Menu.ItemAction
                        show={props.permissionToJoinGroup && !isGroupMember}
                        onClick={joinGroup}
                        text={Utils.localizeMessage('user_groups_modal.joinGroup', 'Join Group')}
                        disabled={false}
                    />
                    <Menu.ItemAction
                        show={props.permissionToLeaveGroup && isGroupMember}
                        onClick={leaveGroup}
                        text={Utils.localizeMessage('user_groups_modal.leaveGroup', 'Leave Group')}
                        disabled={false}
                        isDangerous={true}
                    />
                    <Menu.ItemAction
                        show={props.permissionToArchiveGroup}
                        onClick={archiveGroup}
                        text={Utils.localizeMessage('user_groups_modal.archiveGroup', 'Archive Group')}
                        disabled={false}
                        isDangerous={true}
                    />
                </Menu>
            </MenuWrapper>
        </div>
    );
};

export default React.memo(ViewUserGroupHeaderSubMenu);
