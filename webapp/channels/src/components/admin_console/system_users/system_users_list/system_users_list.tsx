// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useReactTable, createColumnHelper, getCoreRowModel, getSortedRowModel} from '@tanstack/react-table';
import type {CellContext, PaginationState, SortingState} from '@tanstack/react-table';
import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {imageURLForUser} from 'utils/utils';

import AdminConsoleListTable from '../../admin_console_list_table';
import {userReports} from '../sample';
import SystemUsersCellElapsedDays from '../system_users_cell_elapsed_days';
import SystemUsersActions from '../system_users_list_actions';

import './system_users_list.scss';

type SystemUsersRow = {
    id: UserProfile['id'];
    username: UserProfile['username'];
    email: UserProfile['email'];
    display_name: string;
    roles: UserProfile['roles'];
    create_at?: UserProfile['create_at'];
    last_login_at?: number;
    last_status_at?: number;
    last_post_date?: number;
    days_active?: number;
    total_posts?: number;
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

const columnHelper = createColumnHelper<SystemUsersRow>();

interface Props {
    tableAriaDescribedBy: string;
}

function SystemUsersList(props: Props) {
    const {formatMessage} = useIntl();

    const currentUser = useSelector(getCurrentUser);

    const tableId = 'systemUsersTable';

    const columns = useMemo(
        () => [
            {
                id: ColumnNames.displayName,
                accessorKey: 'userDetails',
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
            columnHelper.accessor('email', {
                id: ColumnNames.email,
                header: formatMessage({
                    id: 'admin.system_users.list.email',
                    defaultMessage: 'Email',
                }),
                cell: (info) => info.getValue() || '',
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('create_at', {
                id: ColumnNames.createAt,
                header: formatMessage({
                    id: 'admin.system_users.list.memberSince',
                    defaultMessage: 'Member since',
                }),
                cell: (info) => <SystemUsersCellElapsedDays date={info.getValue()}/>,
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('last_login_at', {
                id: ColumnNames.lastLoginAt,
                header: formatMessage({
                    id: 'admin.system_users.list.lastLoginAt',
                    defaultMessage: 'Last login',
                }),
                cell: (info) => <SystemUsersCellElapsedDays date={info.getValue()}/>,
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('last_status_at', {
                id: ColumnNames.lastStatusAt,
                header: formatMessage({
                    id: 'admin.system_users.list.lastActivity',
                    defaultMessage: 'Last activity',
                }),
                cell: (info) => <SystemUsersCellElapsedDays date={info.getValue()}/>,
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('last_post_date', {
                id: ColumnNames.lastPostDate,
                header: formatMessage({
                    id: 'admin.system_users.list.lastPost',
                    defaultMessage: 'Last post',
                }),
                cell: (info) => <SystemUsersCellElapsedDays date={info.getValue()}/>,
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('days_active', {
                id: ColumnNames.daysActive,
                header: formatMessage({
                    id: 'admin.system_users.list.daysActive',
                    defaultMessage: 'Days active',
                }),
                cell: (info) => info.getValue(),
                meta: {
                    isNumeric: true,
                },
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('total_posts', {
                id: ColumnNames.totalPosts,
                header: formatMessage({
                    id: 'admin.system_users.list.totalPosts',
                    defaultMessage: 'Messages posts',
                }),
                cell: (info) => info.getValue(),
                meta: {
                    isNumeric: true,
                },
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
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
                        currentUserRoles={currentUser.roles}
                    />
                ),
                enableHiding: false,
                enablePinning: true,
                enableSorting: false,
            },
        ],
        [currentUser.roles],
    );

    // Move the following states to redux
    const [paginationState, setPaginationState] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 20,
    });
    const [sortState, setSortState] = useState<SortingState>([]);

    // Change the following useEffects to single useEffect
    useEffect(() => {
        if (sortState.length === 0) {
            // eslint-disable-next-line no-console
            console.log('sortState is empty');
        } else {
            const [{id, desc}] = sortState;
            // eslint-disable-next-line no-console
            console.log('sort on', id, desc);
        }
    }, [sortState]);

    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('page change', paginationState.pageIndex);
    }, [paginationState.pageIndex]);

    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('page size change', paginationState.pageSize);
    }, [paginationState.pageSize]);

    const table = useReactTable({
        data: userReports,
        columns,
        state: {
            sorting: sortState,
            pagination: paginationState,
        },
        getCoreRowModel: getCoreRowModel<SystemUsersRow>(),
        onPaginationChange: setPaginationState,
        onSortingChange: setSortState,
        getSortedRowModel: getSortedRowModel<SystemUsersRow>(),
        manualSorting: true,
        enableSortingRemoval: true,
        enableMultiSort: false,
        manualFiltering: true,
        manualPagination: true,
        renderFallbackValue: '',
        debugAll: true,
    });

    return (
        <AdminConsoleListTable<SystemUsersRow>
            tableId={tableId}
            tableAriaDescribedBy={props.tableAriaDescribedBy}
            table={table}
            tableContainerClass='systemUsersTable'
        />
    );
}

export default SystemUsersList;
