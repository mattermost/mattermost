// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getUser} from 'mattermost-redux/actions/users';

import {getNonBotUsers} from './selectors';
import SystemUsersList from './system_users_list';

type Props = {
    loading: boolean;
    teamId: string;
    term: string;
    filter: string;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const users = getNonBotUsers(state, ownProps.loading, ownProps.teamId, ownProps.term, ownProps.filter);
    return {
        users,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemUsersList);
