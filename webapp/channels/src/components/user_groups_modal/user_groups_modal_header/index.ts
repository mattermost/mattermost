// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {Permissions} from 'mattermost-redux/constants';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import UserGroupsModalHeader from './user_groups_modal_header';

function mapStateToProps(state: GlobalState) {
    const canCreateCustomGroups = haveISystemPermission(state, {permission: Permissions.CREATE_CUSTOM_GROUP});

    return {
        canCreateCustomGroups,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserGroupsModalHeader);
