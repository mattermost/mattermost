// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isEmpty from 'lodash/isEmpty';
import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {withRouter} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getFirstAdminSetupComplete} from 'mattermost-redux/actions/general';
import {getProfiles} from 'mattermost-redux/actions/users';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {shouldShowTermsOfService, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {loadRecentlyUsedCustomEmojis, migrateRecentEmojis} from 'actions/emoji_actions';
import {isDevModeEnabled} from 'selectors/general';
import {getShowLaunchingWorkspace} from 'selectors/onboarding';
import {shouldShowAppBar} from 'selectors/plugins';
import {
    getIsRhsExpanded,
    getIsRhsOpen,
    getRhsState,
} from 'selectors/rhs';
import LocalStorageStore from 'stores/local_storage_store';

import {initializeProducts} from 'plugins/products';

import type {GlobalState} from 'types/store/index';

import {
    loadConfigAndMe,
    registerCustomPostRenderer,
    handleLoginLogoutSignal,
    redirectToOnboardingOrDefaultTeam,
} from './actions';
import Root from './root';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const showTermsOfService = shouldShowTermsOfService(state);
    const plugins = state.plugins.components.CustomRouteComponent;
    const products = state.plugins.components.Product;
    const userId = getCurrentUserId(state);

    const teamId = LocalStorageStore.getPreviousTeamId(userId);
    const permalinkRedirectTeam = getTeam(state, teamId!);

    const isConfigLoaded = config && !isEmpty(config);

    return {
        theme: getTheme(state),
        isConfigLoaded,
        telemetryEnabled: config.DiagnosticsEnabled === 'true',
        noAccounts: config.NoAccounts === 'true',
        telemetryId: config.DiagnosticId,
        serviceEnvironment: config.ServiceEnvironment,
        siteURL: config.SiteURL,
        iosDownloadLink: config.IosAppDownloadLink,
        androidDownloadLink: config.AndroidAppDownloadLink,
        appDownloadLink: config.AppDownloadLink,
        enableDesktopLandingPage: config.EnableDesktopLandingPage === 'true',
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
        isDevModeEnabled: isDevModeEnabled(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            loadConfigAndMe,
            getFirstAdminSetupComplete,
            getProfiles,
            loadRecentlyUsedCustomEmojis,
            migrateRecentEmojis,
            registerCustomPostRenderer,
            initializeProducts,
            handleLoginLogoutSignal,
            redirectToOnboardingOrDefaultTeam,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default withRouter(connector(Root));
