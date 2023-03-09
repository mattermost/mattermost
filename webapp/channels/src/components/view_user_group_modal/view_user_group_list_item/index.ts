// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import {GlobalState} from 'types/store';

import {getGroup as getGroupById} from 'mattermost-redux/selectors/entities/groups';
import {removeUsersFromGroup} from 'mattermost-redux/actions/groups';
import {haveIGroupPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';

import ViewUserGroupListItem from './view_user_group_list_item';

type Actions = {
    removeUsersFromGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
};

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
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            removeUsersFromGroup,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewUserGroupListItem);
