// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {addUsersToGroup, archiveGroup, removeUsersFromGroup} from 'mattermost-redux/actions/groups';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import ViewUserGroupHeaderSubMenu from './view_user_group_header_sub_menu';

function mapStateToProps(state: GlobalState) {
    return {
        currentUserId: getCurrentUserId(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
            removeUsersFromGroup,
            addUsersToGroup,
            archiveGroup,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewUserGroupHeaderSubMenu);
