// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {checkIfTeamExists, createTeam} from 'mattermost-redux/actions/teams';

import TeamUrl from './team_url';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            checkIfTeamExists,
            createTeam,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(TeamUrl);
