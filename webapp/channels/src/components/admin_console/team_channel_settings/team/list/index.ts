// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getTeams as fetchTeams, searchTeams} from 'mattermost-redux/actions/teams';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getTeams} from 'mattermost-redux/selectors/entities/teams';

import {setAdminConsoleTeamsManagementTableProperties} from 'actions/views/admin';
import {getAdminConsoleTeamManagementTableProperties} from 'selectors/views/admin';

import type {GlobalState} from 'types/store';

import TeamList from './team_list';

const getSortedListOfTeams = createSelector(
    'getSortedListOfTeams',
    getTeams,
    (teams) => Object.values(teams).sort((a, b) => a.display_name.localeCompare(b.display_name)),
);

function mapStateToProps(state: GlobalState) {
    const tableProperties = getAdminConsoleTeamManagementTableProperties(state);

    return {
        data: getSortedListOfTeams(state),
        total: state.entities.teams.totalCount || 0,
        isLicensedForLDAPGroups: state.entities.general.license.LDAPGroups === 'true',
        tableProperties,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getData: (page: number, pageSize: number) => fetchTeams(page, pageSize, true),
            searchTeams,
            setAdminConsoleTeamsManagementTableProperties,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamList);
