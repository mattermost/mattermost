// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getUserReports, setAdminConsoleUsersManagementTableProperties} from 'actions/views/admin';
import {adminConsoleUserManagementTablePropertiesInitialState} from 'reducers/views/admin';
import {getAdminConsoleUserManagementTableProperties} from 'selectors/views/admin';

import type {GlobalState} from 'types/store';

import SystemUsers from './system_users';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    const siteName = config.SiteName;
    const mfaEnabled = config.EnableMultifactorAuthentication === 'true';
    const enableUserAccessTokens = config.EnableUserAccessTokens === 'true';
    const experimentalEnableAuthenticationTransfer = config.ExperimentalEnableAuthenticationTransfer === 'true';

    const currentUser = getCurrentUser(state);
    const currentUserRoles = currentUser?.roles || '';

    const tableProperties = getAdminConsoleUserManagementTableProperties(state);
    const sortColumn = tableProperties?.sortColumn ?? adminConsoleUserManagementTablePropertiesInitialState.sortColumn;
    const sortIsDescending = tableProperties?.sortIsDescending ?? adminConsoleUserManagementTablePropertiesInitialState.sortIsDescending;
    const pageSize = tableProperties?.pageSize ?? adminConsoleUserManagementTablePropertiesInitialState.pageSize;

    return {
        siteName,
        mfaEnabled,
        enableUserAccessTokens,
        experimentalEnableAuthenticationTransfer,
        currentUserRoles,
        tablePropertySortColumn: sortColumn,
        tablePropertySortIsDescending: sortIsDescending,
        tablePropertyPageSize: pageSize,
    };
}

const mapDispatchToProps = {
    getUserReports,
    setAdminConsoleUsersManagementTableProperties,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(mapStateToProps, mapDispatchToProps)(SystemUsers);
