// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getUser} from 'mattermost-redux/actions/users';
import {getTeamStats} from 'mattermost-redux/actions/teams';

import TeamMembersDropdown from './team_members_dropdown.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getUser,
            getTeamStats
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamMembersDropdown);
