// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {Action} from 'mattermost-redux/types/actions';
import {checkIfTeamExists, createTeam, updateTeam} from 'mattermost-redux/actions/teams';
import {getProfiles} from 'mattermost-redux/actions/users';

import PreparingWorkspace, {Actions} from './preparing_workspace';

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
