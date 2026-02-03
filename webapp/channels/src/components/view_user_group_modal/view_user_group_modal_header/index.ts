// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {addUsersToGroup, archiveGroup, removeUsersFromGroup, restoreGroup} from 'mattermost-redux/actions/groups';
import {Permissions} from 'mattermost-redux/constants';
import {getGroup as getGroupById, isMyGroup} from 'mattermost-redux/selectors/entities/groups';
import {haveIGroupPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import ViewUserGroupModalHeader from './view_user_group_modal_header';

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
    const permissionToRestoreGroup = haveIGroupPermission(state, ownProps.groupId, Permissions.RESTORE_CUSTOM_GROUP);

    return {
        permissionToEditGroup,
        permissionToJoinGroup,
        permissionToLeaveGroup,
        permissionToArchiveGroup,
        permissionToRestoreGroup,
        isGroupMember,
        group,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
            removeUsersFromGroup,
            addUsersToGroup,
            archiveGroup,
            restoreGroup,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewUserGroupModalHeader);
