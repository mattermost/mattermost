// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {archiveGroup, restoreGroup} from 'mattermost-redux/actions/groups';
import {getGroupListPermissions} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import UserGroupsList from './user_groups_list';

function mapStateToProps(state: GlobalState) {
    const groupPermissionsMap = getGroupListPermissions(state);
    return {
        groupPermissionsMap,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
            archiveGroup,
            restoreGroup,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef: true})(UserGroupsList);
