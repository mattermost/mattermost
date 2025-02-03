// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {checkIfTeamExists, createTeam, updateTeam} from 'mattermost-redux/actions/teams';
import {getProfiles} from 'mattermost-redux/actions/users';

import PreparingWorkspace from './preparing_workspace';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateTeam,
            createTeam,
            getProfiles,
            checkIfTeamExists,
        }, dispatch),
    };
}

const mapStateToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(PreparingWorkspace);
