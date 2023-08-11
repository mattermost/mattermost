// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators, ActionCreatorsMapObject, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {Action} from 'mattermost-redux/types/actions';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {shouldShowTermsOfService, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getFirstAdminSetupComplete} from 'mattermost-redux/actions/general';
import {getProfiles} from 'mattermost-redux/actions/users';

import {getShowLaunchingWorkspace} from 'selectors/onboarding';
import {
    getIsRhsExpanded,
    getIsRhsOpen,
    getRhsState,
} from 'selectors/rhs';
import {shouldShowAppBar} from 'selectors/plugins';
import {migrateRecentEmojis} from 'actions/emoji_actions';
import {loadConfigAndMe, registerCustomPostRenderer} from 'actions/views/root';

import {initializeProducts} from 'plugins/products';

import LocalStorageStore from 'stores/local_storage_store';

import {GlobalState} from 'types/store/index';

import Root, {Actions} from './root';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const showTermsOfService = shouldShowTermsOfService(state);
    const plugins = state.plugins.components.CustomRouteComponent;
    const products = state.plugins.components.Product;
    const userId = getCurrentUserId(state);

    const teamId = LocalStorageStore.getPreviousTeamId(userId);
    const permalinkRedirectTeam = getTeam(state, teamId!);

    return {
        theme: getTheme(state),
        telemetryEnabled: config.DiagnosticsEnabled === 'true',
        noAccounts: config.NoAccounts === 'true',
        telemetryId: config.DiagnosticId,
        permalinkRedirectTeamName: permalinkRedirectTeam ? permalinkRedirectTeam.name : '',
        showTermsOfService,
        plugins,
        products,
        showLaunchingWorkspace: getShowLaunchingWorkspace(state),
        rhsIsExpanded: getIsRhsExpanded(state),
        rhsIsOpen: getIsRhsOpen(state),
        rhsState: getRhsState(state),
        shouldShowAppBar: shouldShowAppBar(state),
        isCloud: isCurrentLicenseCloud(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            loadConfigAndMe,
            getFirstAdminSetupComplete,
            getProfiles,
            migrateRecentEmojis,
            registerCustomPostRenderer,
            initializeProducts,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Root);
