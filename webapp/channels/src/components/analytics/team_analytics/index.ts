// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getTeams} from 'mattermost-redux/actions/teams';
import {getProfilesInTeam} from 'mattermost-redux/actions/users';
import {getTeamsList} from 'mattermost-redux/selectors/entities/teams';

import {setGlobalItem} from 'actions/storage';
import {getCurrentLocale} from 'selectors/i18n';
import {makeGetGlobalItem} from 'selectors/storage';

import type {GlobalState} from 'types/store';

import TeamAnalytics from './team_analytics';

const LAST_ANALYTICS_TEAM = 'last_analytics_team';

function mapStateToProps(state: GlobalState) {
    const teams = getTeamsList(state);
    const teamId = makeGetGlobalItem(LAST_ANALYTICS_TEAM, null)(state);
    const initialTeam = state.entities.teams.teams[teamId] || (teams.length > 0 ? teams[0] : null);

    return {
        initialTeam,
        locale: getCurrentLocale(state),
        teams,
        stats: state.entities.admin.teamAnalytics!,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getTeams,
            getProfilesInTeam,
            setGlobalItem,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamAnalytics);
