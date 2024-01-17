// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getUserCountForReporting, getUserReports, setAdminConsoleUsersManagementTableProperties} from 'actions/views/admin';
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

    const tableProperties = getAdminConsoleUserManagementTableProperties(state);
    const sortColumn = tableProperties?.sortColumn ?? adminConsoleUserManagementTablePropertiesInitialState.sortColumn;
    const sortIsDescending = tableProperties?.sortIsDescending ?? adminConsoleUserManagementTablePropertiesInitialState.sortIsDescending;
    const pageSize = tableProperties?.pageSize ?? adminConsoleUserManagementTablePropertiesInitialState.pageSize;
    const pageIndex = tableProperties?.pageIndex ?? adminConsoleUserManagementTablePropertiesInitialState.pageIndex;
    const direction = tableProperties?.cursorDirection ?? adminConsoleUserManagementTablePropertiesInitialState.cursorDirection;
    const fromId = tableProperties?.cursorUserId ?? adminConsoleUserManagementTablePropertiesInitialState.cursorUserId;
    const fromColumnValue = tableProperties?.cursorColumnValue ?? adminConsoleUserManagementTablePropertiesInitialState.cursorColumnValue;
    const columnVisibility = tableProperties?.columnVisibility ?? adminConsoleUserManagementTablePropertiesInitialState.columnVisibility;

    return {
        siteName,
        mfaEnabled,
        enableUserAccessTokens,
        experimentalEnableAuthenticationTransfer,
        currentUser,
        tablePropertySortColumn: sortColumn,
        tablePropertySortIsDescending: sortIsDescending,
        tablePropertyPageSize: pageSize,
        tablePropertyPageIndex: pageIndex,
        tablePropertyCursorDirection: direction,
        tablePropertyCursorUserId: fromId,
        tablePropertyCursorColumnValue: fromColumnValue,
        tablePropertyColumnVisibility: columnVisibility,
    };
}

const mapDispatchToProps = {
    getUserReports,
    getUserCountForReporting,
    setAdminConsoleUsersManagementTableProperties,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(mapStateToProps, mapDispatchToProps)(SystemUsers);
