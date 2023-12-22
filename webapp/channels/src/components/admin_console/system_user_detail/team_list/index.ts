// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {Team, TeamMembership} from '@mattermost/types/teams';

import {
    getTeamsForUser,
    getTeamMembersForUser,
    removeUserFromTeam,
    updateTeamMemberSchemeRoles,
} from 'mattermost-redux/actions/teams';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {getCurrentLocale} from 'selectors/i18n';

import type {GlobalState} from 'types/store';

import TeamList from './team_list';

type Actions = {
    getTeamsData: (userId: string) => Promise<{data: Team[]}>;
    getTeamMembersForUser: (userId: string) => Promise<{data: TeamMembership[]}>;
    removeUserFromTeam: (userId: string, teamId: string) => Promise<ActionResult>;
    updateTeamMemberSchemeRoles: (userId: string, teamId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => Promise<ActionResult>;
}

function mapStateToProps(state: GlobalState) {
    return {
        locale: getCurrentLocale(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getTeamsData: getTeamsForUser,
            getTeamMembersForUser,
            removeUserFromTeam,
            updateTeamMemberSchemeRoles,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamList);
