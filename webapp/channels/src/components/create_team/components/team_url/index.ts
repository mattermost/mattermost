// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {checkIfTeamExists, createTeam} from 'mattermost-redux/actions/teams';

import {Team} from '@mattermost/types/teams';
import {ServerError} from '@mattermost/types/errors';

import TeamUrl from './team_url';

type Actions = {
    checkIfTeamExists: (teamName: string) => Promise<{data: boolean}>;
    createTeam: (team: Team) => Promise<{data: Team; error: ServerError}>;
};

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            checkIfTeamExists,
            createTeam,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(TeamUrl);
