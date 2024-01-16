// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {CursorPaginationDirection} from '@mattermost/types/reports';
import type {UserReport, UserReportOptions} from '@mattermost/types/reports';

import {AdminConsoleListTable, useReactTable, getCoreRowModel, getSortedRowModel, ElapsedDurationCell, PAGE_SIZES, LoadingStates} from 'components/admin_console/list_table';
import type {CellContext, PaginationState, SortingState, TableMeta, OnChangeFn, ColumnDef, VisibilityState} from 'components/admin_console/list_table';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {getDisplayName, imageURLForUser} from 'utils/utils';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import {ColumnNames} from './constants';
import {RevokeSessionsButton} from './revoke_sessions_button';
import {SystemUsersColumnTogglerMenu} from './system_users_column_toggler_menu';
import {SystemUsersExport} from './system_users_export';
import {SystemUsersFilterMenu} from './system_users_filter_menu';
import {SystemUsersListAction} from './system_users_list_actions';
import {SystemUsersSearch} from './system_users_search';
import {getSortableColumnValueBySortColumn, getSortColumnForOptions, getSortDirectionForOptions, getPaginationInfo} from './utils';

import './system_users.scss';

import type {PropsFromRedux} from './index';

type Props = PropsFromRedux;

const tableId = 'systemUsersTable';

function SystemUsers(props: Props) {
    const {formatMessage} = useIntl();
    const history = useHistory();

    const [userReports, setUserReports] = useState<UserReport[]>([]);
    const [userCount, setUserCount] = useState<number | undefined>();
    const [loadingState, setLoadingState] = useState<LoadingStates>(LoadingStates.Loading);

    const columns: Array<ColumnDef<UserReport, any>> = useMemo(
        () => [
            {
                id: ColumnNames.username,
                accessorKey: 'username',
                header: formatMessage({
                    id: 'admin.system_users.list.userDetails',
                    defaultMessage: 'User details',
                }),
                cell: (info: CellContext<UserReport, null>) => {
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
                            </div>
                            <div
                                className='userName'
                                title={info.row.original.username}
                            >
                                {info.row.original.username}
                            </div>
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
                enableHiding: true,
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
                cell: (info: CellContext<UserReport, number | undefined>) => info.getValue(),
                meta: {
                    isNumeric: true,
                },
                enableHiding: true,
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
                enableHiding: true,
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
                        userRoles={info.row.original.roles}
                        currentUserRoles={props.currentUserRoles}
                    />
                ),
                enableHiding: false,
                enablePinning: true,
                enableSorting: false,
            },
        ],
        [props.currentUserRoles],
    );

    // Effect to get the total user count
    useEffect(() => {
        const getUserCount = async () => {
            const {data} = await props.getUserCountForReporting({});
            setUserCount(data);
        };

        getUserCount();
    }, []);

    // Effect to get the user reports
    useEffect(() => {
        async function fetchUserReportsWithOptions(tableOptions?: {
            pageSize?: PaginationState['pageSize'];
            sortColumn?: SortingState[0]['id'];
            sortIsDescending?: SortingState[0]['desc'];
            fromColumnValue?: AdminConsoleUserManagementTableProperties['cursorColumnValue'];
            fromId?: AdminConsoleUserManagementTableProperties['cursorUserId'];
            direction?: CursorPaginationDirection;
        }) {
            setLoadingState(LoadingStates.Loading);

            const options: UserReportOptions = {
                page_size: tableOptions?.pageSize || PAGE_SIZES[0],
                from_column_value: tableOptions?.fromColumnValue,
                from_id: tableOptions?.fromId,
                direction: tableOptions?.direction,
                ...getSortColumnForOptions(tableOptions?.sortColumn),
                ...getSortDirectionForOptions(tableOptions?.sortIsDescending),
            };

            const {data} = await props.getUserReports(options);

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
        });
    }, [
        props.tablePropertyPageSize,
        props.tablePropertySortColumn,
        props.tablePropertySortIsDescending,
        props.tablePropertyCursorDirection,
        props.tablePropertyCursorColumnValue,
        props.tablePropertyCursorUserId,
    ]);

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

    // Table state which are correctly formatted for the table component

    const sortingTableState = [{
        id: props?.tablePropertySortColumn ?? ColumnNames.displayName,
        desc: props?.tablePropertySortIsDescending ?? false,
    }];

    const paginationTableState = {
        pageIndex: props?.tablePropertyPageIndex ?? 0,
        pageSize: props?.tablePropertyPageSize || PAGE_SIZES[0],
    };

    const table = useReactTable({
        data: userReports,
        columns,
        state: {
            sorting: sortingTableState,
            pagination: paginationTableState,
            columnVisibility: props.tablePropertyColumnVisibility,
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
            hasAdditionalPaginationAtTop: true,
            totalRowInfo: '',
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
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.system_users.title'
                    defaultMessage='{siteName} Users'
                    values={{siteName: props.siteName}}
                >
                    {(formatMessageChunk) => (
                        <span id='systemUsersTable-headerId'>{formatMessageChunk}</span>
                    )}
                </FormattedMessage>
                <RevokeSessionsButton/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__container'>
                    <div className='admin-console__filters-rows'>
                        <SystemUsersSearch/>
                        <SystemUsersFilterMenu/>
                        <SystemUsersColumnTogglerMenu
                            allColumns={table.getAllLeafColumns()}
                            visibleColumnsLength={table.getVisibleLeafColumns()?.length ?? 0}
                        />
                        <SystemUsersExport/>
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
