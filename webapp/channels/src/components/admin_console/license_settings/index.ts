// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {uploadLicense, removeLicense, getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {getServerLimits} from 'mattermost-redux/actions/limits';
import {getFilteredUsersStats} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getFilteredUsersStats as selectFilteredUserStats} from 'mattermost-redux/selectors/entities/users';

import {requestTrialLicense, upgradeToE0Status, upgradeToE0, restartServer, ping} from 'actions/admin_actions';
import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import LicenseSettings from './license_settings';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        totalUsers: selectFilteredUserStats(state)?.total_users_count || 0,
        upgradedFromTE: config.UpgradedFromTE === 'true',
        prevTrialLicense: state.entities.admin.prevTrialLicense,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getLicenseConfig,
            uploadLicense,
            removeLicense,
            getPrevTrialLicense,
            upgradeToE0,
            upgradeToE0Status,
            restartServer,
            ping,
            requestTrialLicense,
            openModal,
            getFilteredUsersStats,
            getServerLimits,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(LicenseSettings);
