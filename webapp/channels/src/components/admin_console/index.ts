// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig} from '@mattermost/types/config';
import {Role} from '@mattermost/types/roles';
import {connect, ConnectedProps} from 'react-redux';
import {withRouter} from 'react-router-dom';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {setNavigationBlocked, deferNavigation, cancelNavigation, confirmNavigation} from 'actions/admin_actions.jsx';
import {selectLhsItem} from 'actions/views/lhs';
import {getConfig, getEnvironmentConfig, updateConfig} from 'mattermost-redux/actions/admin';
import {loadRolesIfNeeded, editRole} from 'mattermost-redux/actions/roles';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {General} from 'mattermost-redux/constants';
import * as Selectors from 'mattermost-redux/selectors/entities/admin';
import {getConfig as getGeneralConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getRoles} from 'mattermost-redux/selectors/entities/roles';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {isCurrentUserSystemAdmin, currentUserHasAnAdminRole, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {getAdminDefinition, getConsoleAccess} from 'selectors/admin_console';
import {showNavigationPrompt} from 'selectors/views/admin';
import LocalStorageStore from 'stores/local_storage_store';

import {GlobalState} from 'types/store';
import {LhsItemType} from 'types/store/lhs';

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

type Actions = {
    getConfig: () => ActionFunc;
    getEnvironmentConfig: () => ActionFunc;
    setNavigationBlocked: () => void;
    confirmNavigation: () => void;
    cancelNavigation: () => void;
    loadRolesIfNeeded: (roles: Iterable<string>) => ActionFunc;
    selectLhsItem: (type: LhsItemType, id?: string) => void;
    selectTeam: (teamId: string) => void;
    editRole: (role: Role) => void;
    updateConfig?: (config: AdminConfig) => ActionFunc;
};

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            getConfig,
            getEnvironmentConfig,
            updateConfig,
            setNavigationBlocked,
            deferNavigation,
            cancelNavigation,
            confirmNavigation,
            loadRolesIfNeeded,
            editRole,
            selectLhsItem,
            selectTeam,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default withRouter(connector(AdminConsole));
