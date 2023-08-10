// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import UserListRow from './user_list_row_with_error';

import type {UserProfile} from '@mattermost/types/users';
import type {GlobalState} from 'types/store';

type OwnProps = {
    user: UserProfile;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const user = ownProps.user;
    return {
        status: getStatusForUserId(state, user.id),
    };
}

export default connect(mapStateToProps)(UserListRow);
