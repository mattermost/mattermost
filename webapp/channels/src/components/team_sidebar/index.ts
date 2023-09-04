// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {withRouter} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {ClientConfig} from '@mattermost/types/config';
import type {Team} from '@mattermost/types/teams';

import {getTeams} from 'mattermost-redux/actions/teams';
import {getTeamsUnreadStatuses} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {
    getCurrentTeamId,
    getJoinableTeamIds,
    getMyTeams,
} from 'mattermost-redux/selectors/entities/teams';
import type {GenericAction, GetStateFunc} from 'mattermost-redux/types/actions';

import {switchTeam, updateTeamsOrderForUser} from 'actions/team_actions';
import {getCurrentLocale} from 'selectors/i18n';
import {getIsLhsOpen} from 'selectors/lhs';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import TeamSidebar from './team_sidebar';

function mapStateToProps(state: GlobalState) {
    const config: Partial<ClientConfig> = getConfig(state);

    const experimentalPrimaryTeam: string | undefined = config.ExperimentalPrimaryTeam;
    const joinableTeams: string[] = getJoinableTeamIds(state);
    const moreTeamsToJoin: boolean = joinableTeams && joinableTeams.length > 0;
    const products = state.plugins.components.Product || [];

    const [unreadTeamsSet, mentionsInTeamMap, teamHasUrgentMap] = getTeamsUnreadStatuses(state);

    return {
        currentTeamId: getCurrentTeamId(state),
        myTeams: getMyTeams(state),
        isOpen: getIsLhsOpen(state),
        experimentalPrimaryTeam,
        locale: getCurrentLocale(state),
        moreTeamsToJoin,
        userTeamsOrderPreference: get(state, Preferences.TEAMS_ORDER, '', ''),
        products,
        unreadTeamsSet,
        mentionsInTeamMap,
        teamHasUrgentMap,
    };
}

type Actions = {
    getTeams: (page?: number, perPage?: number, includeTotalCount?: boolean) => void;
    switchTeam: (url: string, team?: Team) => (dispatch: Dispatch<GenericAction>, getState: GetStateFunc) => void;
    updateTeamsOrderForUser: (teamIds: string[]) => (dispatch: Dispatch<GenericAction>, getState: GetStateFunc) => Promise<void>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            getTeams,
            switchTeam,
            updateTeamsOrderForUser,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default withRouter(connector(TeamSidebar));
