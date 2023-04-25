// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {Action, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {getTeams} from 'mattermost-redux/actions/teams';
import {getProfilesInTeam} from 'mattermost-redux/actions/users';
import {getTeamsList} from 'mattermost-redux/selectors/entities/teams';

import {GlobalState} from 'types/store';

import {getCurrentLocale} from 'selectors/i18n';

import {setGlobalItem} from 'actions/storage';
import {makeGetGlobalItem} from 'selectors/storage';

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

type Actions = {
    getTeams: (page?: number, perPage?: number, includeTotalCount?: boolean, excludePolicyConstrained?: boolean) => void;
    getProfilesInTeam: (teamId: string, page: number, perPage?: number, sort?: string, options?: undefined) => Promise<ActionResult>;
    setGlobalItem: (name: string, value: string) => void;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            getTeams,
            getProfilesInTeam,
            setGlobalItem,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamAnalytics);
