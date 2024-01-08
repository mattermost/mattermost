// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {UserReportSortColumns, ReportSortDirection, CursorPaginationDirection} from '@mattermost/types/reports';
import type {UserReport, UserReportOptions} from '@mattermost/types/reports';
import type {UserProfile} from '@mattermost/types/users';

import {AdminConsoleListTable, useReactTable, getCoreRowModel, getSortedRowModel, ElapsedDurationCell, PAGE_SIZES, LoadingStates} from 'components/admin_console/list_table';
import type {CellContext, PaginationState, SortingState, TableMeta, OnChangeFn, ColumnDef} from 'components/admin_console/list_table';

import {imageURLForUser} from 'utils/utils';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import SystemUsersActions from '../system_users_list_actions';

import './system_users_list.scss';

type Props = {
    currentUserRoles: UserProfile['roles'];
    tablePropertySortColumn: AdminConsoleUserManagementTableProperties['sortColumn'];
    tablePropertySortIsDescending: AdminConsoleUserManagementTableProperties['sortIsDescending'];
    tablePropertyPageSize: AdminConsoleUserManagementTableProperties['pageSize'];
    getUserReports: (options?: UserReportOptions) => Promise<{data: UserReport[]}>;
    setAdminConsoleUsersManagementTableProperties: (properties: Partial<AdminConsoleUserManagementTableProperties>) => void;
};

type SystemUsersRow = {
    id: UserProfile['id'];
    username: UserProfile['username'];
    email: UserProfile['email'];
    display_name: string;
    roles: UserProfile['roles'];
    create_at: UserProfile['create_at'];
    last_login_at?: number;
    last_status_at?: number;
    last_post_date?: number;
    days_active?: number;
    total_posts?: number;
};

type Cursor = {
    userId?: string;
    columnValue?: string;
    direction?: CursorPaginationDirection;
}

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
    const [cursor, setCursor] = useState<Cursor>({direction: CursorPaginationDirection.down});

    const columns: Array<ColumnDef<SystemUsersRow, any>> = useMemo(
        () => [
            {
                id: ColumnNames.displayName,
                accessorKey: 'username',
                header: formatMessage({
                    id: 'admin.system_users.list.userDetails',
                    defaultMessage: 'User details',
                }),
                cell: (info: CellContext<SystemUsersRow, null>) => {
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
                                title={info.row.original.display_name}
                            >
                                {info.row.original.display_name || ''}
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
                cell: (info: CellContext<SystemUsersRow, string>) => info.getValue() || '',
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
                cell: (info: CellContext<SystemUsersRow, number>) => <ElapsedDurationCell date={info.getValue()}/>,
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
                cell: (info: CellContext<SystemUsersRow, number | undefined>) => <ElapsedDurationCell date={info.getValue()}/>,
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
                cell: (info: CellContext<SystemUsersRow, number | undefined>) => <ElapsedDurationCell date={info.getValue()}/>,
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
                cell: (info: CellContext<SystemUsersRow, number | undefined>) => <ElapsedDurationCell date={info.getValue()}/>,
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
                cell: (info: CellContext<SystemUsersRow, number | undefined>) => info.getValue(),
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
                cell: (info: CellContext<SystemUsersRow, number | undefined>) => info.getValue() || null,
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
                cell: (info: CellContext<SystemUsersRow, null>) => (
                    <SystemUsersActions
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

    useEffect(() => {
        async function fetchUserReportsWithOptions(tableOptions?: {
            pageSize?: PaginationState['pageSize'];
            sortColumn?: SortingState[0]['id'];
            sortIsDescending?: SortingState[0]['desc'];
            cursor?: Cursor;
        }) {
            setLoadingState(LoadingStates.Loading);

            const options: UserReportOptions = {
                page_size: tableOptions?.pageSize || PAGE_SIZES[0],
                ...getSortColumnForOptions(tableOptions?.sortColumn),
                ...getSortDirectionForOptions(tableOptions?.sortIsDescending),
                ...getCursorValuesForOptions(tableOptions?.cursor),
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
            cursor,
        });
    }, [props.tablePropertyPageSize, props.tablePropertySortColumn, props.tablePropertySortIsDescending, cursor]);

    function handleRowClick(userId: SystemUsersRow['id']) {
        if (userId.length !== 0) {
            history.push(`/admin_console/user_management/user/${userId}`);
        }
    }

    function handlePreviousPageClick() {
        if (!userReports.length) {
            return;
        }

        setCursor({
            direction: CursorPaginationDirection.up,
            userId: userReports[0].id,
            columnValue: userReports[0].username,
        });
    }

    function handleNextPageClick() {
        if (!userReports.length) {
            return;
        }

        setCursor({
            direction: CursorPaginationDirection.down,
            userId: userReports[userReports.length - 1].id, 
            columnValue: userReports[userReports.length - 1].username,
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
            disablePrevPage: typeof cursor.userId == 'undefined',
            disableNextPage: userReports.length < paginationTableState.pageSize,
            onRowClick: handleRowClick,
            onPreviousPageClick: handlePreviousPageClick,
            onNextPageClick: handleNextPageClick,
            hasAdditionalPaginationAtTop: false,
            totalRowInfo: '',
        } as TableMeta,
        getCoreRowModel: getCoreRowModel<SystemUsersRow>(),
        getSortedRowModel: getSortedRowModel<SystemUsersRow>(),
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
        <AdminConsoleListTable<SystemUsersRow>
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

function getCursorValuesForOptions(cursor?: Cursor): Partial<Pick<UserReportOptions, 'from_column_value' | 'from_id' |'direction'>> {
    return {
        from_column_value: cursor?.columnValue,
        from_id: cursor?.userId,
        direction: cursor?.direction,
    };
}

export default SystemUsersList;
