// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from '@mattermost/types/store';

import AnyTeamPermissionGate from './any_team_permission_gate';

type Props = {
    permissions: string[];
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const teams = getMyTeams(state);
    for (const team of teams) {
        for (const permission of ownProps.permissions) {
            if (haveITeamPermission(state, team.id, permission)) {
                return {hasPermission: true};
            }
        }
    }

    return {hasPermission: false};
}

export default connect(mapStateToProps)(AnyTeamPermissionGate);
