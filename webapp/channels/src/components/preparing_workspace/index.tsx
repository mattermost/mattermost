// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {checkIfTeamExists, createTeam, updateTeam} from 'mattermost-redux/actions/teams';
import {getProfiles} from 'mattermost-redux/actions/users';

import PreparingWorkspace from './preparing_workspace';

import type {Actions} from './preparing_workspace';
import type {Action} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            updateTeam,
            createTeam,
            getProfiles,
            checkIfTeamExists,
        }, dispatch),
    };
}

const mapStateToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(PreparingWorkspace);
