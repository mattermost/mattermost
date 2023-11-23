// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {withRouter} from 'react-router-dom';
import {bindActionCreators, compose} from 'redux';
import type {Dispatch} from 'redux';

import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';
import {getTeams} from 'mattermost-redux/actions/teams';
import {Permissions} from 'mattermost-redux/constants';
import {getCloudSubscription as selectCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getSortedListableTeams, getTeamMemberships} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import {addUserToTeam} from 'actions/team_actions';

import withUseGetUsageDelta from 'components/common/hocs/cloud/with_use_get_usage_deltas';

import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import SelectTeam from './select_team';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentUser = getCurrentUser(state);
    const myTeamMemberships = Object.values(getTeamMemberships(state));
    const license = getLicense(state);

    const subscription = selectCloudSubscription(state);
    const isCloud = isCloudLicense(license);
    const isFreeTrial = subscription?.is_free_trial === 'true';

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
        siteURL: config.SiteURL,
        totalTeamsCount: state.entities.teams.totalCount || 0,
        isCloud,
        isFreeTrial,
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

export default compose(
    withRouter,
    connect(mapStateToProps, mapDispatchToProps),
    withUseGetUsageDelta,
)(SelectTeam) as any;
