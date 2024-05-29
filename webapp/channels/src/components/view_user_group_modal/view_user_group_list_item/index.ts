// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {removeUsersFromGroup} from 'mattermost-redux/actions/groups';
import {Permissions} from 'mattermost-redux/constants';
import {getGroup as getGroupById} from 'mattermost-redux/selectors/entities/groups';
import {haveIGroupPermission} from 'mattermost-redux/selectors/entities/roles';

import type {GlobalState} from 'types/store';

import ViewUserGroupListItem from './view_user_group_list_item';

type OwnProps = {
    groupId: string;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const group = getGroupById(state, ownProps.groupId);
    const permissionToLeaveGroup = haveIGroupPermission(state, ownProps.groupId, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS);

    return {
        group,
        permissionToLeaveGroup,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            removeUsersFromGroup,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewUserGroupListItem);
