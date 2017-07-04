// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getTeams} from 'mattermost-redux/actions/teams';
import {getProfilesInTeam} from 'mattermost-redux/actions/users';

import {getTeamsList} from 'mattermost-redux/selectors/entities/teams';
import BrowserStore from 'stores/browser_store.jsx';

import TeamAnalytics from './team_analytics.jsx';

const LAST_ANALYTICS_TEAM = 'last_analytics_team';

function mapStateToProps(state, ownProps) {
    const teams = getTeamsList(state);
    const teamId = BrowserStore.getGlobalItem(LAST_ANALYTICS_TEAM, teams.length > 0 ? teams[0].id : '');

    return {
        initialTeam: state.entities.teams.teams[teamId],
        teams,
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getTeams,
            getProfilesInTeam
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamAnalytics);
