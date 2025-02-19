// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {Permissions} from 'mattermost-redux/constants';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {
    getConfig,
    getLicense,
    isMarketplaceEnabled,
} from 'mattermost-redux/selectors/entities/general';
import {
    getInt,
    isCustomGroupsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentTeamPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import {OnboardingTaskCategory, OnboardingTasksName, TaskNameMapToSteps} from 'components/onboarding_tasks';

import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import ProductMenuList from './product_menu_list';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentTeam = getCurrentTeam(state);

    const appDownloadLink = config.AppDownloadLink || '';
    const siteName = config.SiteName || 'Mattermost';

    const isCurrentUserAdmin = isCurrentUserSystemAdmin(state);
    const haveEnabledCustomUserGroups = isCustomGroupsEnabled(state);
    const haveEnabledPluginMarketplace = isMarketplaceEnabled(state);
    const haveEnabledSlashCommands = config.EnableCommands === 'true';
    const haveEnabledIncomingWebhooks = config.EnableIncomingWebhooks === 'true';
    const haveEnabledOutgoingWebhooks = config.EnableOutgoingWebhooks === 'true';
    const haveEnabledOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';

    const havePermissionToManageTeamIntegrations = (haveICurrentTeamPermission(state, Permissions.MANAGE_SLASH_COMMANDS) || haveICurrentTeamPermission(state, Permissions.MANAGE_OAUTH) || haveICurrentTeamPermission(state, Permissions.MANAGE_INCOMING_WEBHOOKS) || haveICurrentTeamPermission(state, Permissions.MANAGE_OUTGOING_WEBHOOKS));
    const havePermissionToManageSystemBots = (haveISystemPermission(state, {permission: Permissions.MANAGE_BOTS}) || haveISystemPermission(state, {permission: Permissions.MANAGE_OTHERS_BOTS}));
    const areIntegrationsEnabled = haveEnabledIncomingWebhooks || haveEnabledOutgoingWebhooks || haveEnabledSlashCommands || haveEnabledOAuthServiceProvider || havePermissionToManageSystemBots || havePermissionToManageTeamIntegrations || havePermissionToManageSystemBots;

    const subscription = getCloudSubscription(state);
    const license = getLicense(state);
    const isCloud = isCloudLicense(license);
    const isCloudFreeTrial = isCloud && subscription?.is_free_trial === 'true';
    const isSelfHostedFreeTrial = license.IsTrial === 'true';
    const isFreeTrial = isCloudFreeTrial || isSelfHostedFreeTrial;

    const step = getInt(state, OnboardingTaskCategory, OnboardingTasksName.VISIT_SYSTEM_CONSOLE, 0);
    const showVisitSystemConsoleTour = step === TaskNameMapToSteps[OnboardingTasksName.VISIT_SYSTEM_CONSOLE].STARTED;

    return {
        appDownloadLink,
        siteName,
        teamId: currentTeam?.id,
        teamName: currentTeam?.name,
        isCurrentUserAdmin,
        haveEnabledCustomUserGroups,
        haveEnabledPluginMarketplace,
        areIntegrationsEnabled,
        isFreeTrial,
        showVisitSystemConsoleTour,
    };
}

const mapDispatchToProps = {
    getPrevTrialLicense,
    openModal,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(ProductMenuList);
