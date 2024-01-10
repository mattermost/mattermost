// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {UserReportSortColumns, ReportSortDirection} from '@mattermost/types/reports';
import type {UserReport, UserReportOptions} from '@mattermost/types/reports';
import type {UserProfile} from '@mattermost/types/users';

import {AdminConsoleListTable, useReactTable, getCoreRowModel, getSortedRowModel, ElapsedDurationCell, PAGE_SIZES, LoadingStates} from 'components/admin_console/list_table';
import type {CellContext, PaginationState, SortingState, TableMeta, OnChangeFn, ColumnDef} from 'components/admin_console/list_table';

import {getDisplayName, imageURLForUser} from 'utils/utils';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import SystemUsersActions from '../system_users_list_actions';

import './system_users_list.scss';

type Props = {
    currentUser: UserProfile;
    tablePropertySortColumn: AdminConsoleUserManagementTableProperties['sortColumn'];
    tablePropertySortIsDescending: AdminConsoleUserManagementTableProperties['sortIsDescending'];
    tablePropertyPageSize: AdminConsoleUserManagementTableProperties['pageSize'];
    getUserReports: (options?: UserReportOptions) => Promise<{data: UserReport[]}>;
    setAdminConsoleUsersManagementTableProperties: (properties: Partial<AdminConsoleUserManagementTableProperties>) => void;
};

enum ColumnNames {
    displayName = 'displayNameColumn',
    email = 'emailColumn',
    createAt = 'createAtColumn',
    lastLoginAt = 'lastLoginColumn',
    lastStatusAt = 'lastStatusAtColumn',
    lastPostDate = 'lastPostDateColumn',
    daysActive = 'daysActiveColumn',
    totalPosts = 'totalPostsColumn',
    actions = 'actionsColumn',
}

function SystemUsersList(props: Props) {
    const tableId = 'systemUsersTable';

    const {formatMessage} = useIntl();
    const history = useHistory();

    const [userReports, setUserReports] = useState<UserReport[]>([]);
    const [loadingState, setLoadingState] = useState<LoadingStates>(LoadingStates.Loading);

    const columns: Array<ColumnDef<UserReport, any>> = useMemo(
        () => [
            {
                id: ColumnNames.displayName,
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
                    <SystemUsersActions
                        user={info.row.original}
                        rowIndex={info.cell.row.index}
                        tableId={tableId}
                        currentUser={props.currentUser}
                    />
                ),
                enableHiding: false,
                enablePinning: true,
                enableSorting: false,
            },
        ],
        [props.currentUser],
    );

    useEffect(() => {
        async function fetchUserReportsWithOptions(pageSize?: PaginationState['pageSize'], sortColumn?: SortingState[0]['id'], sortIsDescending?: SortingState[0]['desc']) {
            setLoadingState(LoadingStates.Loading);

            const options: UserReportOptions = {
                page_size: pageSize || PAGE_SIZES[0],
                ...getSortColumnForOptions(sortColumn),
                ...getSortDirectionForOptions(sortIsDescending),
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

        fetchUserReportsWithOptions(props.tablePropertyPageSize, props.tablePropertySortColumn, props.tablePropertySortIsDescending);
    }, [props.tablePropertyPageSize, props.tablePropertySortColumn, props.tablePropertySortIsDescending]);

    function handleRowClick(userId: UserReport['id']) {
        if (userId.length !== 0) {
            history.push(`/admin_console/user_management/user/${userId}`);
        }
    }

    function handlePreviousPageClick() {
        // eslint-disable-next-line no-console
        console.log('previous page click');
    }

    function handleNextPageClick() {
        // eslint-disable-next-line no-console
        console.log('next page click');
    }

    function handleSortingChange(updateFn: (currentSortingState: SortingState) => SortingState) {
        const currentSortingState = [{id: props.tablePropertySortColumn, desc: props.tablePropertySortIsDescending}];
        const [updatedSortingState] = updateFn(currentSortingState);

        if (props.tablePropertySortColumn !== updatedSortingState.id) {
            // If we are clicking on a new column, we want to sort in descending order
            updatedSortingState.desc = false;
        }

        props.setAdminConsoleUsersManagementTableProperties({
            sortColumn: updatedSortingState.id,
            sortIsDescending: updatedSortingState.desc,
        });
    }

    function handlePaginationChange(updateFn: (currentPaginationState: PaginationState) => PaginationState) {
        const currentPaginationState = {pageIndex: 0, pageSize: props.tablePropertyPageSize};
        const updatedPaginationState = updateFn(currentPaginationState);

        props.setAdminConsoleUsersManagementTableProperties({
            pageSize: updatedPaginationState.pageSize,
        });
    }

    const sortingTableState = [{
        id: props?.tablePropertySortColumn ?? ColumnNames.displayName,
        desc: props?.tablePropertySortIsDescending ?? false,
    }];
    const paginationTableState = {
        pageIndex: 0, // We are using cursor based pagination so this is always 0
        pageSize: props?.tablePropertyPageSize ?? PAGE_SIZES[0],
    };

    const table = useReactTable({
        data: userReports,
        columns,
        state: {
            sorting: sortingTableState,
            pagination: paginationTableState,
        },
        meta: {
            tableId: 'systemUsersTable',
            tableCaption: formatMessage({id: 'admin.system_users.list.caption', defaultMessage: 'System Users'}),
            loadingState,
            onRowClick: handleRowClick,
            onPreviousPageClick: handlePreviousPageClick,
            onNextPageClick: handleNextPageClick,
            hasAdditionalPaginationAtTop: false,
            totalRowInfo: '',
        } as TableMeta,
        getCoreRowModel: getCoreRowModel<UserReport>(),
        getSortedRowModel: getSortedRowModel<UserReport>(),
        onPaginationChange: handlePaginationChange as OnChangeFn<PaginationState>,
        onSortingChange: handleSortingChange as OnChangeFn<SortingState>,
        manualSorting: true,
        enableSortingRemoval: false,
        enableMultiSort: false,
        manualFiltering: true,
        manualPagination: true,
        renderFallbackValue: '',
    });

    return (
        <AdminConsoleListTable<UserReport>
            table={table}
        />
    );
}

/**
 * Converts the sorting column name to API compatible sorting column name. Default sorting column name is by username.
 */
function getSortColumnForOptions(id?: SortingState[0]['id']): Pick<UserReportOptions, 'sort_column'> {
    let sortColumn: UserReportOptions['sort_column'];

    if (id === ColumnNames.email) {
        sortColumn = UserReportSortColumns.email;
    } else if (id === ColumnNames.createAt) {
        sortColumn = UserReportSortColumns.createAt;
    } else {
        // Default sorting to first User details column
        sortColumn = UserReportSortColumns.username;
    }

    return {
        sort_column: sortColumn,
    };
}

/**
 * Converts the sorting direction to API compatible sorting direction. Default sorting direction is ascending.
 */
function getSortDirectionForOptions(desc?: SortingState[0]['desc']): Pick<UserReportOptions, 'sort_direction'> {
    let sortDirection: UserReportOptions['sort_direction'];

    if (desc) {
        sortDirection = ReportSortDirection.descending;
    } else {
        sortDirection = ReportSortDirection.ascending;
    }

    return {
        sort_direction: sortDirection,
    };
}

export default SystemUsersList;
