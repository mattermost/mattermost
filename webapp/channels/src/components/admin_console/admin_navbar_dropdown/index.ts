// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {deferNavigation} from 'actions/admin_actions.jsx';
import {getCurrentLocale} from 'selectors/i18n';
import {getNavigationBlocked} from 'selectors/views/admin';

import type {GlobalState} from 'types/store';

import AdminNavbarDropdown from './admin_navbar_dropdown';

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const isLicensed = license.IsLicensed === 'true';
    const isCloud = license.Cloud === 'true';

    return {
        locale: getCurrentLocale(state),
        teams: getMyTeams(state),
        siteName: getConfig(state).SiteName,
        navigationBlocked: getNavigationBlocked(state),
        isLicensed,
        isCloud,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            deferNavigation,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AdminNavbarDropdown);
