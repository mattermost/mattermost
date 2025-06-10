// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {createGroupWithUserIds} from 'mattermost-redux/actions/groups';

import {openModal} from 'actions/views/modals';

import CreateUserGroupsModal from './create_user_groups_modal';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            createGroupWithUserIds,
            openModal,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(CreateUserGroupsModal);
