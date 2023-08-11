// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import {addUsersToGroup, archiveGroup, removeUsersFromGroup} from 'mattermost-redux/actions/groups';
import {Permissions} from 'mattermost-redux/constants';
import {getGroup as getGroupById, isMyGroup} from 'mattermost-redux/selectors/entities/groups';
import {haveIGroupPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';

import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

import ViewUserGroupModalHeader from './view_user_group_modal_header';

type Actions = {
    openModal: <P>(modalData: ModalData<P>) => void;
    removeUsersFromGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
    addUsersToGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
    archiveGroup: (groupId: string) => Promise<ActionResult>;
};

type OwnProps = {
    groupId: string;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const isGroupMember = isMyGroup(state, ownProps.groupId);
    const group = getGroupById(state, ownProps.groupId);

    const permissionToEditGroup = haveIGroupPermission(state, ownProps.groupId, Permissions.EDIT_CUSTOM_GROUP);
    const permissionToJoinGroup = haveIGroupPermission(state, ownProps.groupId, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS);
    const permissionToLeaveGroup = haveIGroupPermission(state, ownProps.groupId, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS);
    const permissionToArchiveGroup = haveIGroupPermission(state, ownProps.groupId, Permissions.DELETE_CUSTOM_GROUP);

    return {
        permissionToEditGroup,
        permissionToJoinGroup,
        permissionToLeaveGroup,
        permissionToArchiveGroup,
        isGroupMember,
        group,
        currentUserId: getCurrentUserId(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            openModal,
            removeUsersFromGroup,
            addUsersToGroup,
            archiveGroup,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewUserGroupModalHeader);
