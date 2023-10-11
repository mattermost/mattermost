// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {ServerError} from '@mattermost/types/errors';
import type {Team} from '@mattermost/types/teams';

import {checkIfTeamExists, createTeam} from 'mattermost-redux/actions/teams';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';

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
