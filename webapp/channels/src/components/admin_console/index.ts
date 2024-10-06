// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getConfig, getEnvironmentConfig, patchConfig} from 'mattermost-redux/actions/admin';
import {loadRolesIfNeeded, editRole} from 'mattermost-redux/actions/roles';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {General} from 'mattermost-redux/constants';
import * as Selectors from 'mattermost-redux/selectors/entities/admin';
import {getConfig as getGeneralConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getRoles} from 'mattermost-redux/selectors/entities/roles';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {isCurrentUserSystemAdmin, currentUserHasAnAdminRole, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {setNavigationBlocked, deferNavigation, cancelNavigation, confirmNavigation} from 'actions/admin_actions.jsx';
import {setAdminConsoleUsersManagementTableProperties} from 'actions/views/admin';
import {selectLhsItem} from 'actions/views/lhs';
import {getAdminDefinition, getConsoleAccess} from 'selectors/admin_console';
import {showNavigationPrompt} from 'selectors/views/admin';
import LocalStorageStore from 'stores/local_storage_store';

import type {GlobalState} from 'types/store';

import AdminConsole from './admin_console';

function mapStateToProps(state: GlobalState) {
    const generalConfig = getGeneralConfig(state);
    const buildEnterpriseReady = generalConfig.BuildEnterpriseReady === 'true';
    const adminDefinition = getAdminDefinition(state);
    const teamId = LocalStorageStore.getPreviousTeamId(getCurrentUserId(state));
    const team = getTeam(state, teamId || '');
    const unauthorizedRoute = team ? `/${team.name}/channels/${General.DEFAULT_CHANNEL}` : '/';
    const consoleAccess = getConsoleAccess(state);

    return {
        config: Selectors.getConfig(state),
        environmentConfig: Selectors.getEnvironmentConfig(state),
        license: getLicense(state),
        buildEnterpriseReady,
        unauthorizedRoute,
        showNavigationPrompt: showNavigationPrompt(state),
        isCurrentUserSystemAdmin: isCurrentUserSystemAdmin(state),
        currentUserHasAnAdminRole: currentUserHasAnAdminRole(state),
        roles: getRoles(state),
        adminDefinition,
        consoleAccess,
        cloud: state.entities.cloud,
        team,
        currentTheme: getTheme(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getConfig,
            getEnvironmentConfig,
            patchConfig,
            setNavigationBlocked,
            deferNavigation,
            cancelNavigation,
            confirmNavigation,
            loadRolesIfNeeded,
            editRole,
            selectLhsItem,
            selectTeam,
            setAdminConsoleUsersManagementTableProperties,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(AdminConsole);
