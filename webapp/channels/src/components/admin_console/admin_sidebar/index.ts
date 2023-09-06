// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {PluginsResponse} from '@mattermost/types/plugins';

import {getPlugins} from 'mattermost-redux/actions/admin';
import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {isFirstAdmin} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {getAdminDefinition, getConsoleAccess} from 'selectors/admin_console';
import {getNavigationBlocked} from 'selectors/views/admin';
import {getIsMobileView} from 'selectors/views/browser';

import {OnboardingTaskCategory, OnboardingTaskList} from 'components/onboarding_tasks';

import type {GlobalState} from 'types/store';

import AdminSidebar from './admin_sidebar';

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const config = getConfig(state);
    const buildEnterpriseReady = config.BuildEnterpriseReady === 'true';
    const siteName = config.SiteName;
    const adminDefinition = getAdminDefinition(state);
    const consoleAccess = getConsoleAccess(state);
    const taskListStatus = getBool(state, OnboardingTaskCategory, OnboardingTaskList.ONBOARDING_TASK_LIST_SHOW);
    const isUserFirstAdmin = isFirstAdmin(state);
    const isMobileView = getIsMobileView(state);
    const showTaskList = isUserFirstAdmin && taskListStatus && !isMobileView;
    const subscriptionProduct = getSubscriptionProduct(state);

    return {
        license,
        config: state.entities.admin.config,
        plugins: state.entities.admin.plugins,
        navigationBlocked: getNavigationBlocked(state),
        buildEnterpriseReady,
        siteName,
        adminDefinition,
        consoleAccess,
        cloud: state.entities.cloud,
        showTaskList,
        subscriptionProduct,
    };
}

type Actions = {
    getPlugins: () => Promise<{data: PluginsResponse}>;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getPlugins,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps, null, {pure: false});

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(AdminSidebar);
