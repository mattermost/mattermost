// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';
import {getTeams} from 'mattermost-redux/actions/teams';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getSortedListableTeams, getTeamMemberships} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import {addUserToTeam} from 'actions/team_actions';

import type {GlobalState} from 'types/store';

import SelectTeam from './select_team';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentUser = getCurrentUser(state);
    const myTeamMemberships = Object.values(getTeamMemberships(state));

    return {
        currentUserId: currentUser.id,
        currentUserRoles: currentUser.roles || '',
        currentUserIsGuest: isGuest(currentUser.roles),
        customDescriptionText: config.CustomDescriptionText,
        isMemberOfTeam: myTeamMemberships && myTeamMemberships.length > 0,
        listableTeams: getSortedListableTeams(state, currentUser.locale),
        siteName: config.SiteName,
        canCreateTeams: haveISystemPermission(state, {permission: Permissions.CREATE_TEAM}),
        canManageSystem: haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM}),
        canJoinPublicTeams: haveISystemPermission(state, {permission: Permissions.JOIN_PUBLIC_TEAMS}),
        canJoinPrivateTeams: haveISystemPermission(state, {permission: Permissions.JOIN_PRIVATE_TEAMS}),
        totalTeamsCount: state.entities.teams.totalCount || 0,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getTeams,
            loadRolesIfNeeded,
            addUserToTeam,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectTeam);
