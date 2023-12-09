// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, type CellContext, getCoreRowModel} from '@tanstack/react-table';
import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import {imageURLForUser} from 'utils/utils';

import AdminConsoleListTable from '../admin_console_list_table';
import {userReports} from '../sample';
import SystemUsersCellElapsedDays from '../system_users_cell_elapsed_days';
import SystemUsersActions from '../system_users_list_actions';

import './system_users_list.scss';

export type SystemUsersRow = {
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

function SystemUsersList() {
    const {formatMessage} = useIntl();

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
                cell: (info) => <SystemUsersCellElapsedDays date={info.getValue() || 0}/>,
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
                cell: (info) => <SystemUsersCellElapsedDays date={info.getValue() || 0}/>,
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
                cell: (info) => <SystemUsersCellElapsedDays date={info.getValue() || 0}/>,
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
                cell: (info) => <SystemUsersCellElapsedDays date={info.getValue() || 0}/>,
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
                cell: (info) => info.getValue() || '',
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
                cell: (info) => info.getValue() || '',
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
                        currentUserRoles=''
                    />
                ),
                enableHiding: false,
                enablePinning: true,
                enableSorting: false,
            },
        ],
        [],
    );

    return (
        <div>
            <AdminConsoleListTable<SystemUsersRow>
                tableId={tableId}
                tableContainerClass='systemUsersTable'
                columns={columns}
                data={userReports}
                getCoreRowModel={getCoreRowModel}
            />
        </div>
    );
}

export default SystemUsersList;
