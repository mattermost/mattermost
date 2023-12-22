// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {DataRetentionCustomPolicy} from '@mattermost/types/data_retention';
import type {Team, TeamSearchOpts} from '@mattermost/types/teams';

import {getDataRetentionCustomPolicyTeams, searchDataRetentionCustomPolicyTeams as searchTeams} from 'mattermost-redux/actions/admin';
import {getDataRetentionCustomPolicy} from 'mattermost-redux/selectors/entities/admin';
import {getTeamsInPolicy, searchTeamsInPolicy} from 'mattermost-redux/selectors/entities/teams';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import {teamListToMap, filterTeamsStartingWithTerm} from 'mattermost-redux/utils/team_utils';

import {setTeamListSearch} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import TeamList from './team_list';

type OwnProps = {
    policyId?: string;
    teamsToAdd: Record<string, Team>;
}

type Actions = {
    getDataRetentionCustomPolicyTeams: (id: string, page: number, perPage: number) => Promise<{ data: Team[] }>;
    searchTeams: (id: string, term: string, opts: TeamSearchOpts) => Promise<{ data: Team[] }>;
    setTeamListSearch: (term: string) => ActionResult;
}

function searchTeamsToAdd(teams: Record<string, Team>, term: string): Record<string, Team> {
    const filteredTeams = filterTeamsStartingWithTerm(Object.keys(teams).map((key) => teams[key]), term);
    return teamListToMap(filteredTeams);
}

function mapStateToProps() {
    const getPolicyTeams = getTeamsInPolicy();
    return (state: GlobalState, ownProps: OwnProps) => {
        let {teamsToAdd} = ownProps;

        let teams: Team[] = [];
        const policyId = ownProps.policyId;
        const policy = policyId ? getDataRetentionCustomPolicy(state, policyId) || {} as DataRetentionCustomPolicy : {} as DataRetentionCustomPolicy;
        let totalCount = 0;
        const searchTerm = state.views.search.teamListSearch || '';
        teams = policyId ? getPolicyTeams(state, {policyId}) : [];
        if (searchTerm) {
            teams = searchTeamsInPolicy(teams, searchTerm) || [];
            teamsToAdd = searchTeamsToAdd(teamsToAdd, searchTerm);
            totalCount = teams.length;
        } else if (policy?.team_count) {
            totalCount = policy.team_count;
        }

        return {
            teams,
            totalCount,
            searchTerm,
            teamsToAdd,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            getDataRetentionCustomPolicyTeams,
            searchTeams,
            setTeamListSearch,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamList);
