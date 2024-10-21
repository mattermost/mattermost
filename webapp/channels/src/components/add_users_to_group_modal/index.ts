// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getGroup} from 'mattermost-redux/selectors/entities/groups';

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

export default connect(mapStateToProps)(AddUsersToGroupModal);
