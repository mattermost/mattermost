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

import {RoleFilters, StatusFilter, TeamFilters} from './constants';
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
    const tablePropertySortColumn = tableProperties?.sortColumn ?? adminConsoleUserManagementTablePropertiesInitialState.sortColumn;
    const tablePropertySortIsDescending = tableProperties?.sortIsDescending ?? adminConsoleUserManagementTablePropertiesInitialState.sortIsDescending;
    const tablePropertyPageSize = tableProperties?.pageSize ?? adminConsoleUserManagementTablePropertiesInitialState.pageSize;
    const tablePropertyPageIndex = tableProperties?.pageIndex ?? adminConsoleUserManagementTablePropertiesInitialState.pageIndex;
    const tablePropertyCursorDirection = tableProperties?.cursorDirection ?? adminConsoleUserManagementTablePropertiesInitialState.cursorDirection;
    const tablePropertyCursorUserId = tableProperties?.cursorUserId ?? adminConsoleUserManagementTablePropertiesInitialState.cursorUserId;
    const tablePropertyCursorColumnValue = tableProperties?.cursorColumnValue ?? adminConsoleUserManagementTablePropertiesInitialState.cursorColumnValue;
    const tablePropertyColumnVisibility = tableProperties?.columnVisibility ?? adminConsoleUserManagementTablePropertiesInitialState.columnVisibility;
    const tablePropertySearchTerm = tableProperties?.searchTerm ?? adminConsoleUserManagementTablePropertiesInitialState.searchTerm;
    const tablePropertyFilterTeam = tableProperties?.filterTeam ?? TeamFilters.AllTeams;
    const tablePropertyFilterTeamLabel = tableProperties?.filterTeamLabel ?? '';
    const tablePropertyFilterRole = tableProperties?.filterRole ?? RoleFilters.Any;
    const tablePropertyFilterStatus = tableProperties?.filterStatus ?? StatusFilter.Any;
    const tablePropertyDateRange = tableProperties?.dateRange ?? ReportDuration.AllTime;

    return {
        siteName,
        mfaEnabled,
        enableUserAccessTokens,
        experimentalEnableAuthenticationTransfer,
        currentUser,
        isMySql,
        hideMySqlNotification,
        tablePropertySortColumn,
        tablePropertySortIsDescending,
        tablePropertyPageSize,
        tablePropertyPageIndex,
        tablePropertyCursorDirection,
        tablePropertyCursorUserId,
        tablePropertyCursorColumnValue,
        tablePropertyColumnVisibility,
        tablePropertySearchTerm,
        tablePropertyFilterTeam,
        tablePropertyFilterTeamLabel,
        tablePropertyFilterRole,
        tablePropertyFilterStatus,
        tablePropertyDateRange,
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
