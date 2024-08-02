// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PaginationState, SortingState, VisibilityState, ColumnDef, CellContext, OnChangeFn} from '@tanstack/react-table';
import {useReactTable, getCoreRowModel, getSortedRowModel} from '@tanstack/react-table';
import React, {useEffect, useMemo, useState} from 'react';
import {useIntl, FormattedMessage, defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {useHistory} from 'react-router-dom';

import type {ServerError} from '@mattermost/types/errors';
import {CursorPaginationDirection} from '@mattermost/types/reports';
import type {ReportDuration, UserReport} from '@mattermost/types/reports';

import Preferences from 'mattermost-redux/constants/preferences';

import {AdminConsoleListTable, ElapsedDurationCell, PAGE_SIZES, LoadingStates} from 'components/admin_console/list_table';
import type {TableMeta} from 'components/admin_console/list_table';
import AlertBanner from 'components/alert_banner';
import SharedUserIndicator from 'components/shared_user_indicator';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {getDisplayName, imageURLForUser} from 'utils/utils';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import {ColumnNames} from './constants';
import {RevokeSessionsButton} from './revoke_sessions_button';
import {SystemUsersColumnTogglerMenu} from './system_users_column_toggler_menu';
import {SystemUsersDateRangeMenu} from './system_users_date_range_menu';
import {SystemUsersExport} from './system_users_export';
import {SystemUsersFilterPopover} from './system_users_filters_popover';
import {SystemUsersListAction} from './system_users_list_actions';
import {SystemUsersSearch} from './system_users_search';
import {getSortableColumnValueBySortColumn, getPaginationInfo, convertTableOptionsToUserReportOptions} from './utils';

import './system_users.scss';

import type {PropsFromRedux} from './index';

type Props = PropsFromRedux;

export type TableOptions = {
    pageSize?: PaginationState['pageSize'];
    sortColumn?: SortingState[0]['id'];
    sortIsDescending?: SortingState[0]['desc'];
    fromColumnValue?: AdminConsoleUserManagementTableProperties['cursorColumnValue'];
    fromId?: AdminConsoleUserManagementTableProperties['cursorUserId'];
    direction?: CursorPaginationDirection;
    searchTerm?: string;
    filterTeam?: AdminConsoleUserManagementTableProperties['filterTeam'];
    filterRole?: AdminConsoleUserManagementTableProperties['filterRole'];
    filterStatus?: AdminConsoleUserManagementTableProperties['filterStatus'];
    dateRange?: ReportDuration;
}

type UserReportWithError = UserReport & {error?: ServerError};

const tableId = 'systemUsersTable';

const messages = defineMessages({
    title: {id: 'admin.system_users.title', defaultMessage: '{siteName} Users'},
});

export const searchableStrings: Array<string|MessageDescriptor|[MessageDescriptor, {[key: string]: any}]> = [[messages.title, {siteName: ''}]];

function SystemUsers(props: Props) {
    const {formatMessage} = useIntl();
    const history = useHistory();

    const [userReports, setUserReports] = useState<UserReportWithError[]>([]);
    const [userCount, setUserCount] = useState<number | undefined>();
    const [loadingState, setLoadingState] = useState<LoadingStates>(LoadingStates.Loading);
    const [showMySqlBanner, setShowMySqlBanner] = useState(props.isMySql && !props.hideMySqlNotification);

    // Effect to get the total user count
    useEffect(() => {
        const getUserCount = async (tableOptions?: TableOptions) => {
            const {data} = await props.getUserCountForReporting(convertTableOptionsToUserReportOptions(tableOptions));
            setUserCount(data);
        };

        getUserCount({
            pageSize: props.tablePropertyPageSize,
            sortColumn: props.tablePropertySortColumn,
            sortIsDescending: props.tablePropertySortIsDescending,
            fromColumnValue: props.tablePropertyCursorColumnValue,
            fromId: props.tablePropertyCursorUserId,
            direction: props.tablePropertyCursorDirection,
            searchTerm: props.tablePropertySearchTerm,
            filterTeam: props.tablePropertyFilterTeam,
            filterRole: props.tablePropertyFilterRole,
            filterStatus: props.tablePropertyFilterStatus,
        });
    }, [
        props.tablePropertyPageSize,
        props.tablePropertySortColumn,
        props.tablePropertySortIsDescending,
        props.tablePropertyCursorDirection,
        props.tablePropertyCursorColumnValue,
        props.tablePropertyCursorUserId,
        props.tablePropertySearchTerm,
        props.tablePropertyFilterTeam,
        props.tablePropertyFilterRole,
        props.tablePropertyFilterStatus,
    ]);

    // Effect to get the user reports
    useEffect(() => {
        async function fetchUserReportsWithOptions(tableOptions?: TableOptions) {
            setLoadingState(LoadingStates.Loading);

            const {data} = await props.getUserReports(convertTableOptionsToUserReportOptions(tableOptions));

            if (data) {
                if (data.length > 0) {
                    setUserReports(data);
                } else {
                    setUserReports([]);
                }
                setLoadingState(LoadingStates.Loaded);
            } else {
                setLoadingState(LoadingStates.Failed);
            }
        }

        fetchUserReportsWithOptions({
            pageSize: props.tablePropertyPageSize,
            sortColumn: props.tablePropertySortColumn,
            sortIsDescending: props.tablePropertySortIsDescending,
            fromColumnValue: props.tablePropertyCursorColumnValue,
            fromId: props.tablePropertyCursorUserId,
            direction: props.tablePropertyCursorDirection,
            searchTerm: props.tablePropertySearchTerm,
            filterTeam: props.tablePropertyFilterTeam,
            filterRole: props.tablePropertyFilterRole,
            filterStatus: props.tablePropertyFilterStatus,
            dateRange: props.tablePropertyDateRange,
        });
    }, [
        props.tablePropertyPageSize,
        props.tablePropertySortColumn,
        props.tablePropertySortIsDescending,
        props.tablePropertyCursorDirection,
        props.tablePropertyCursorColumnValue,
        props.tablePropertyCursorUserId,
        props.tablePropertySearchTerm,
        props.tablePropertyFilterRole,
        props.tablePropertyFilterTeam,
        props.tablePropertyFilterStatus,
        props.tablePropertyDateRange,
    ]);

    function handleDismissMySqlNotice() {
        setShowMySqlBanner(false);
        props.savePreferences(props.currentUser.id, [{
            category: Preferences.CATEGORY_REPORTING,
            name: Preferences.HIDE_MYSQL_STATS_NOTIFICATION,
            user_id: props.currentUser.id,
            value: 'true',
        }]);
    }

    // Handlers for table actions

    function handleRowClick(userId: UserReport['id']) {
        if (userId.length !== 0) {
            history.push(`/admin_console/user_management/user/${userId}`);
        }
    }

    function handlePreviousPageClick() {
        if (!userReports.length) {
            return;
        }

        props.setAdminConsoleUsersManagementTableProperties({
            pageIndex: props.tablePropertyPageIndex - 1,
            cursorDirection: CursorPaginationDirection.prev,
            cursorUserId: userReports[0].id,
            cursorColumnValue: getSortableColumnValueBySortColumn(userReports[0], props.tablePropertySortColumn),
        });
    }

    function handleNextPageClick() {
        if (!userReports.length) {
            return;
        }

        props.setAdminConsoleUsersManagementTableProperties({
            pageIndex: props.tablePropertyPageIndex + 1,
            cursorDirection: CursorPaginationDirection.next,
            cursorUserId: userReports[userReports.length - 1].id,
            cursorColumnValue: getSortableColumnValueBySortColumn(userReports[userReports.length - 1], props.tablePropertySortColumn),
        });
    }

    function handleSortingChange(updateFn: (currentSortingState: SortingState) => SortingState) {
        const currentSortingState = [{id: props.tablePropertySortColumn, desc: props.tablePropertySortIsDescending}];
        const [updatedSortingState] = updateFn(currentSortingState);

        if (props.tablePropertySortColumn !== updatedSortingState.id) {
            // If we are clicking on a new column, we want to sort in descending order
            updatedSortingState.desc = false;
        }

        props.setAdminConsoleUsersManagementTableProperties({
            pageIndex: 0,
            cursorDirection: undefined, // reset the cursor to the beginning on any filter change
            cursorUserId: undefined,
            cursorColumnValue: undefined,
            sortColumn: updatedSortingState.id,
            sortIsDescending: updatedSortingState.desc,
        });
    }

    function handlePaginationChange(updateFn: (currentPaginationState: PaginationState) => PaginationState) {
        const currentPaginationState = {pageIndex: 0, pageSize: props.tablePropertyPageSize};
        const updatedPaginationState = updateFn(currentPaginationState);

        props.setAdminConsoleUsersManagementTableProperties({
            pageIndex: 0,
            cursorDirection: undefined, // reset the cursor to the beginning on any filter change
            cursorUserId: undefined,
            cursorColumnValue: undefined,
            pageSize: updatedPaginationState.pageSize,
        });
    }

    function handleColumnVisibilityChange(updateFn: (currentVisibilityState: VisibilityState) => VisibilityState) {
        const updatedVisibilityState = updateFn(props.tablePropertyColumnVisibility);

        props.setAdminConsoleUsersManagementTableProperties({
            columnVisibility: Object.assign({}, props.tablePropertyColumnVisibility, updatedVisibilityState),
        });
    }

    function updateUserReport(userId: string, updatedReport: Partial<UserReportWithError>) {
        setUserReports(userReports.map((user) => {
            if (user.id === userId) {
                return {
                    ...user,
                    error: undefined,
                    ...updatedReport,
                };
            }

            return user;
        }));
    }

    const columns: Array<ColumnDef<UserReport, any>> = useMemo(
        () => [
            {
                id: ColumnNames.username,
                accessorKey: 'username',
                header: formatMessage({
                    id: 'admin.system_users.list.userDetails',
                    defaultMessage: 'User details',
                }),
                cell: (info: CellContext<UserReportWithError, null>) => {
                    const isRemoteUser = Boolean(info.row.original?.remote_id?.length);
                    return (
                        <div>
                            <div className='profilePictureContainer'>
                                <img
                                    className='profilePicture'
                                    src={imageURLForUser(info.row.original.id)}
                                    aria-hidden='true'
                                />
                            </div>
                            <div
                                className='displayName'
                                title={getDisplayName(info.row.original)}
                            >
                                {getDisplayName(info.row.original) || ''}
                                {isRemoteUser && (
                                    <SharedUserIndicator
                                        id={`sharedUserIndicator-${info.row.original.id}`}
                                        title={formatMessage({id: 'admin.system_users.list.userIsRemote', defaultMessage: 'Remote user'})}
                                        ariaLabel={formatMessage({id: 'admin.system_users.list.userIsRemoteAriaLabel', defaultMessage: 'This is a remote user'})}
                                        role='img'
                                        className='icon-12'
                                        withTooltip={true}
                                        placement='top'
                                    />
                                )}
                            </div>
                            <div
                                className='userName'
                                title={info.row.original.username}
                            >
                                {info.row.original.username}
                            </div>
                            {info.row.original.error &&
                            <div
                                className='error'
                                title={info.row.original.error.message}
                            >
                                {info.row.original.error.message}
                            </div>}
                        </div>
                    );
                },
                enableHiding: false,
                enablePinning: true,
                enableSorting: true,
            },
            {
                id: ColumnNames.email,
                accessorKey: 'email',
                header: formatMessage({
                    id: 'admin.system_users.list.email',
                    defaultMessage: 'Email',
                }),
                cell: (info: CellContext<UserReport, string>) => info.getValue() || '',
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            },
            {
                id: ColumnNames.createAt,
                accessorKey: 'create_at',
                header: formatMessage({
                    id: 'admin.system_users.list.memberSince',
                    defaultMessage: 'Member since',
                }),
                cell: (info: CellContext<UserReport, number>) => <ElapsedDurationCell date={info.getValue()}/>,
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            },
            {
                id: ColumnNames.lastLoginAt,
                accessorKey: 'last_login_at',
                header: formatMessage({
                    id: 'admin.system_users.list.lastLoginAt',
                    defaultMessage: 'Last login',
                }),
                cell: (info: CellContext<UserReport, number | undefined>) => <ElapsedDurationCell date={info.getValue()}/>,
                enableHiding: true,
                enablePinning: false,
                enableSorting: false,
            },
            {
                id: ColumnNames.lastStatusAt,
                accessorKey: 'last_status_at',
                header: formatMessage({
                    id: 'admin.system_users.list.lastActivity',
                    defaultMessage: 'Last activity',
                }),
                cell: (info: CellContext<UserReport, number | undefined>) => <ElapsedDurationCell date={info.getValue()}/>,
                enableHiding: true,
                enablePinning: false,
                enableSorting: false,
            },
            {
                id: ColumnNames.lastPostDate,
                accessorKey: 'last_post_date',
                header: formatMessage({
                    id: 'admin.system_users.list.lastPost',
                    defaultMessage: 'Last post',
                }),
                cell: (info: CellContext<UserReport, number | undefined>) => <ElapsedDurationCell date={info.getValue()}/>,
                enableHiding: !props.isMySql,
                enablePinning: false,
                enableSorting: false,
            },
            {
                id: ColumnNames.daysActive,
                accessorKey: 'days_active',
                header: formatMessage({
                    id: 'admin.system_users.list.daysActive',
                    defaultMessage: 'Days active',
                }),
                cell: (info: CellContext<UserReport, number | undefined>) => info.getValue() || null,
                meta: {
                    isNumeric: true,
                },
                enableHiding: !props.isMySql,
                enablePinning: false,
                enableSorting: false,
            },
            {
                id: ColumnNames.totalPosts,
                accessorKey: 'total_posts',
                header: formatMessage({
                    id: 'admin.system_users.list.totalPosts',
                    defaultMessage: 'Messages posted',
                }),
                cell: (info: CellContext<UserReport, number | undefined>) => info.getValue() || null,
                meta: {
                    isNumeric: true,
                },
                enableHiding: !props.isMySql,
                enablePinning: false,
                enableSorting: false,
            },
            {
                id: ColumnNames.actions,
                accessorKey: 'actions',
                header: formatMessage({
                    id: 'admin.system_users.list.actions',
                    defaultMessage: 'Actions',
                }),
                cell: (info: CellContext<UserReport, null>) => (
                    <SystemUsersListAction
                        rowIndex={info.cell.row.index}
                        tableId={tableId}
                        user={info.row.original}
                        currentUser={props.currentUser}
                        updateUser={(updatedUser) => updateUserReport(info.row.original.id, updatedUser)}
                        onError={(error) => updateUserReport(info.row.original.id, {error})}
                    />
                ),
                enableHiding: false,
                enablePinning: true,
                enableSorting: false,
            },
        ],
        [props.currentUser, userReports],
    );

    // Table state which are correctly formatted for the table component

    const sortingTableState = [{
        id: props && props.tablePropertySortColumn && props.tablePropertySortColumn.length > 0 ? props.tablePropertySortColumn : ColumnNames.username,
        desc: props?.tablePropertySortIsDescending ?? false,
    }];

    const paginationTableState = {
        pageIndex: props?.tablePropertyPageIndex ?? 0,
        pageSize: props?.tablePropertyPageSize || PAGE_SIZES[0],
    };

    const columnVisibility = {
        ...props.tablePropertyColumnVisibility,
        ...(props.isMySql ? {
            [ColumnNames.lastPostDate]: false,
            [ColumnNames.daysActive]: false,
            [ColumnNames.totalPosts]: false,
        } : {}),
    };

    const table = useReactTable({
        data: userReports,
        columns,
        state: {
            sorting: sortingTableState,
            pagination: paginationTableState,
            columnVisibility,
        },
        meta: {
            tableId: 'systemUsersTable',
            tableCaption: formatMessage({id: 'admin.system_users.list.caption', defaultMessage: 'System Users'}),
            loadingState,
            disablePrevPage: !props.tablePropertyCursorUserId || props.tablePropertyPageIndex <= 0 || (props.tablePropertyCursorDirection === 'prev' && userReports.length < paginationTableState.pageSize),
            disableNextPage: props.tablePropertyCursorDirection === 'next' && userReports.length < paginationTableState.pageSize,
            onRowClick: handleRowClick,
            onPreviousPageClick: handlePreviousPageClick,
            onNextPageClick: handleNextPageClick,
            paginationInfo: getPaginationInfo(paginationTableState.pageIndex, paginationTableState.pageSize, userReports.length, userCount),
            hasDualSidedPagination: true,
        } as TableMeta,
        getCoreRowModel: getCoreRowModel<UserReport>(),
        getSortedRowModel: getSortedRowModel<UserReport>(),
        onPaginationChange: handlePaginationChange as OnChangeFn<PaginationState>,
        onSortingChange: handleSortingChange as OnChangeFn<SortingState>,
        onColumnVisibilityChange: handleColumnVisibilityChange as OnChangeFn<VisibilityState>,
        manualSorting: true,
        enableSortingRemoval: false,
        enableMultiSort: false,
        manualFiltering: true,
        manualPagination: true,
        renderFallbackValue: '',
    });

    return (
        <div
            className='wrapper--fixed'
            data-testid='systemUsersSection'
        >
            <AdminHeader>
                <FormattedMessage
                    {...messages.title}
                    values={{siteName: props.siteName}}
                >
                    {(formatMessageChunk) => (
                        <span id='systemUsersTable-headerId'>{formatMessageChunk}</span>
                    )}
                </FormattedMessage>
                <RevokeSessionsButton/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                {showMySqlBanner &&
                <AlertBanner
                    className='systemUsers__mySqlAlertBanner'
                    mode='warning'
                    title={
                        <FormattedMessage
                            id='admin.system_users.mysql_stats.title'
                            defaultMessage='Some statistics are unavailable for servers using MySQL'
                        />
                    }
                    message={
                        <>
                            <FormattedMessage
                                id='admin.system_users.mysql_stats.desc'
                                defaultMessage='Use of MySQL may limit the availability of some statistics features. We recommend transitioning from MySQL to PostgreSQL to fully leverage improved performance and comprehensive analytics. While you’re still using MySQL, please use the export functionality to view all user statistics.'
                            />
                            <div className='systemUsers__mySqlAlertBanner-buttons'>
                                <button
                                    type='button'
                                    className='btn btn-primary'
                                    onClick={() => window.open('https://mattermost.com/pl/user-stats-learn-more', '_blank')}
                                >
                                    <FormattedMessage
                                        id='admin.system_users.mysql_stats.learn_more'
                                        defaultMessage='Learn more'
                                    />
                                </button>
                                <button
                                    type='button'
                                    className='btn btn-tertiary'
                                    onClick={handleDismissMySqlNotice}
                                >
                                    <FormattedMessage
                                        id='admin.system_users.mysql_stats.dismiss'
                                        defaultMessage='Dismiss'
                                    />
                                </button>
                            </div>
                        </>
                    }
                    onDismiss={handleDismissMySqlNotice}
                />
                }
                <div className='admin-console__container ignore-marking'>
                    <div className='admin-console__filters-rows'>
                        <SystemUsersSearch
                            searchTerm={props.tablePropertySearchTerm}
                        />
                        <SystemUsersFilterPopover
                            filterTeam={props.tablePropertyFilterTeam}
                            filterTeamLabel={props.tablePropertyFilterTeamLabel}
                            filterRole={props.tablePropertyFilterRole}
                            filterStatus={props.tablePropertyFilterStatus}
                        />
                        <SystemUsersColumnTogglerMenu
                            isMySql={props.isMySql}
                            allColumns={table.getAllLeafColumns()}
                            visibleColumnsLength={table.getVisibleLeafColumns()?.length ?? 0}
                        />
                        <SystemUsersDateRangeMenu
                            dateRange={props.tablePropertyDateRange}
                        />
                        <SystemUsersExport
                            currentUserId={props.currentUser.id}
                            dateRange={props.tablePropertyDateRange}
                        />
                    </div>
                    <AdminConsoleListTable<UserReport>
                        table={table}
                    />
                </div>
            </div>
        </div>
    );
}

export default SystemUsers;
