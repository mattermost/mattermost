// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {addUsersToGroup} from 'mattermost-redux/actions/groups';
import {getGroup} from 'mattermost-redux/selectors/entities/groups';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import AddUsersToGroupModal from './add_users_to_group_modal';

type OwnProps = {
    groupId: string;
}

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const group = getGroup(state, props.groupId);

    return {
        group,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addUsersToGroup,
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddUsersToGroupModal);
