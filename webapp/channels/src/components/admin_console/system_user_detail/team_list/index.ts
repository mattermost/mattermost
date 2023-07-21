// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team, TeamMembership} from '@mattermost/types/teams';
import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {
    getTeamsForUser,
    getTeamMembersForUser,
    removeUserFromTeam,
    updateTeamMemberSchemeRoles,
} from 'mattermost-redux/actions/teams';
import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import {getCurrentLocale} from 'selectors/i18n';

import {GlobalState} from 'types/store';

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
