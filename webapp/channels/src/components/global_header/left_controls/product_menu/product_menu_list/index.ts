// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {Permissions} from 'mattermost-redux/constants';
import {getCloudSubscription, getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {
    getConfig,
    getFirstAdminVisitMarketplaceStatus,
    getLicense,
    isMarketplaceEnabled,
} from 'mattermost-redux/selectors/entities/general';
import {
    getInt,
    isCustomGroupsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentTeamPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';

import {OnboardingTaskCategory, OnboardingTasksName, TaskNameMapToSteps} from 'components/onboarding_tasks';

import {CloudProducts} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import ProductMenuList from './product_menu_list';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentTeam = getCurrentTeam(state);
    const currentUser = getCurrentUser(state);

    const appDownloadLink = config.AppDownloadLink || '';
    const enableCommands = config.EnableCommands === 'true';
    const siteName = config.SiteName || 'Mattermost';
    const enableIncomingWebhooks = config.EnableIncomingWebhooks === 'true';
    const enableOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';
    const enableOutgoingWebhooks = config.EnableOutgoingWebhooks === 'true';
    const enablePluginMarketplace = isMarketplaceEnabled(state);
    const canManageTeamIntegrations = (haveICurrentTeamPermission(state, Permissions.MANAGE_SLASH_COMMANDS) || haveICurrentTeamPermission(state, Permissions.MANAGE_OAUTH) || haveICurrentTeamPermission(state, Permissions.MANAGE_INCOMING_WEBHOOKS) || haveICurrentTeamPermission(state, Permissions.MANAGE_OUTGOING_WEBHOOKS));
    const canManageSystemBots = (haveISystemPermission(state, {permission: Permissions.MANAGE_BOTS}) || haveISystemPermission(state, {permission: Permissions.MANAGE_OTHERS_BOTS}));
    const canManageIntegrations = canManageTeamIntegrations || canManageSystemBots;
    const step = getInt(state, OnboardingTaskCategory, OnboardingTasksName.VISIT_SYSTEM_CONSOLE, 0);
    const showVisitSystemConsoleTour = step === TaskNameMapToSteps[OnboardingTasksName.VISIT_SYSTEM_CONSOLE].STARTED;
    const enableCustomUserGroups = isCustomGroupsEnabled(state);
    const isMobile = getIsMobileView(state);

    const subscription = getCloudSubscription(state);
    const license = getLicense(state);
    const subscriptionProduct = getSubscriptionProduct(state);

    const isCloud = isCloudLicense(license);
    const isCloudStarterFree = isCloud && subscriptionProduct?.sku === CloudProducts.STARTER;
    const isCloudFreeTrial = isCloud && subscription?.is_free_trial === 'true';

    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    const isSelfHostedStarter = isEnterpriseReady && (license.IsLicensed === 'false');
    const isSelfHostedFreeTrial = license.IsTrial === 'true';

    const isStarterFree = isCloudStarterFree || isSelfHostedStarter;
    const isFreeTrial = isCloudFreeTrial || isSelfHostedFreeTrial;

    return {
        isMobile,
        appDownloadLink,
        enableCommands,
        canManageIntegrations,
        enableIncomingWebhooks,
        enableOAuthServiceProvider,
        enableOutgoingWebhooks,
        canManageSystemBots,
        enablePluginMarketplace,
        pluginMenuItems: state.plugins.components.MainMenu,
        siteName,
        teamId: currentTeam?.id,
        teamName: currentTeam?.name,
        currentUser,
        firstAdminVisitMarketplaceStatus: getFirstAdminVisitMarketplaceStatus(state),
        showVisitSystemConsoleTour,
        enableCustomUserGroups,
        isStarterFree,
        isFreeTrial,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
            getPrevTrialLicense,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ProductMenuList);
