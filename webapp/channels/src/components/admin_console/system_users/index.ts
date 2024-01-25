// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import {ReportDuration} from '@mattermost/types/reports';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import Preferences from 'mattermost-redux/constants/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get as getPreferences} from 'mattermost-redux/selectors/entities/preferences';

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
    const isMySql = config.SQLDriverName === 'mysql';
    const hideMySqlNotification = getPreferences(state, Preferences.CATEGORY_REPORTING, Preferences.HIDE_MYSQL_STATS_NOTIFICATION, '') === 'true';

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
    const searchTerm = tableProperties?.searchTerm ?? adminConsoleUserManagementTablePropertiesInitialState.searchTerm;
    const tablePropertyFilterRole = tableProperties?.filterRole;
    const tablePropertyFilterStatus = tableProperties?.filterStatus ?? adminConsoleUserManagementTablePropertiesInitialState.filterStatus;
    const dateRange = tableProperties?.dateRange ?? ReportDuration.AllTime;

    return {
        siteName,
        mfaEnabled,
        enableUserAccessTokens,
        experimentalEnableAuthenticationTransfer,
        currentUser,
        isMySql,
        hideMySqlNotification,
        tablePropertySortColumn: sortColumn,
        tablePropertySortIsDescending: sortIsDescending,
        tablePropertyPageSize: pageSize,
        tablePropertyPageIndex: pageIndex,
        tablePropertyCursorDirection: direction,
        tablePropertyCursorUserId: fromId,
        tablePropertyCursorColumnValue: fromColumnValue,
        tablePropertyColumnVisibility: columnVisibility,
        tablePropertySearchTerm: searchTerm,
        tablePropertyFilterRole,
        tablePropertyFilterStatus,
        tablePropertyDateRange: dateRange,
    };
}

const mapDispatchToProps = {
    getUserReports,
    getUserCountForReporting,
    savePreferences,
    setAdminConsoleUsersManagementTableProperties,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(mapStateToProps, mapDispatchToProps)(SystemUsers);
