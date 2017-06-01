// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import QuickSwitchModal from './quick_switch_modal.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        showTeamSwitcher: getMyTeams(state).length > 1
    };
}

export default connect(mapStateToProps)(QuickSwitchModal);
