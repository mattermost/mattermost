// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getTeams, getTeamStats} from 'mattermost-redux/actions/teams';
import {getUser, getUserAccessToken} from 'mattermost-redux/actions/users';

import {getTeamsList} from 'mattermost-redux/selectors/entities/teams';

import SystemUsers from './system_users.jsx';

function mapStateToProps(state, ownProps) {
    return {
        teams: getTeamsList(state),
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getTeams,
            getTeamStats,
            getUser,
            getUserAccessToken
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemUsers);
