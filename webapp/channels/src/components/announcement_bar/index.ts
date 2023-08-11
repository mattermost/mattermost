// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getStandardAnalytics} from 'mattermost-redux/actions/admin';
import {getCloudSubscription, getCloudCustomer} from 'mattermost-redux/actions/cloud';
import {dismissError} from 'mattermost-redux/actions/errors';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig, getLicense, warnMetricsStatus as getWarnMetricsStatus} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {getDisplayableErrors} from 'mattermost-redux/selectors/errors';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {dismissNotice} from 'actions/views/notice';

import type {GlobalState} from 'types/store';

import AnnouncementBarController from './announcement_bar_controller';

function mapStateToProps(state: GlobalState) {
    const canViewSystemErrors = haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM});
    const license = getLicense(state);
    const config = getConfig(state);
    const errors = getDisplayableErrors(state);
    const warnMetricsStatus = getWarnMetricsStatus(state);
    const isCloud = license.Cloud === 'true';
    const subscription = state.entities.cloud?.subscription;
    const userIsAdmin = isCurrentUserSystemAdmin(state);

    let latestError = null;
    if (errors && errors.length >= 1) {
        latestError = errors[0];
    }

    return {
        license,
        config,
        canViewSystemErrors,
        latestError,
        warnMetricsStatus,
        isCloud,
        subscription,
        userIsAdmin,
    };
}

//
function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    const dismissFirstError = dismissError.bind(null, 0);
    return {
        actions: bindActionCreators({
            getStandardAnalytics,
            dismissError: dismissFirstError,
            dismissNotice,
            getCloudSubscription,
            getCloudCustomer,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AnnouncementBarController);
