// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CellContext} from '@tanstack/react-table';
import {
    createColumnHelper,
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import classNames from 'classnames';
import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import {imageURLForUser} from 'utils/utils';

import {sampleData} from './sample';

import './index.scss';

type Props = {
    tableContainerClass?: string;
};

type AdminConsoleUserRow = {
    id: UserProfile['id'];
    userName: UserProfile['username'];
    email: UserProfile['email'];
    displayName: string;
    createAt?: UserProfile['create_at'];
    lastLogin?: number;
    lastStatusAt?: number;
    lastPostDate?: number;
    daysActive?: number;
    totalPosts?: number;
};

enum ColumnNames {
    displayName = 'displayNameColumn',
    email = 'emailColumn',
    createAt = 'createAtColumn',
    lastLogin = 'lastLoginColumn',
    lastStatusAt = 'lastStatusAtColumn',
    lastPostDate = 'lastPostDateColumn',
    daysActive = 'daysActiveColumn',
    totalPosts = 'totalPostsColumn',
    actions = 'actionsColumn',
}

const columnHelper = createColumnHelper<AdminConsoleUserRow>();

function AdminConsoleListTable(props: Props) {
    const {formatMessage} = useIntl();

    const columns = useMemo(
        () => [
            {
                id: ColumnNames.displayName,
                accessorKey: 'userDetails',
                header: formatMessage({
                    id: 'admin.system_users.list.userDetails',
                    defaultMessage: 'User details',
                }),
                cell: (info: CellContext<AdminConsoleUserRow, null>) => {
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
                                title={info.row.original.displayName}
                            >
                                {info.row.original.displayName || ''}
                            </div>
                            <div
                                className='userName'
                                title={info.row.original.userName}
                            >
                                {info.row.original.userName}
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
            columnHelper.accessor('createAt', {
                id: ColumnNames.createAt,
                header: formatMessage({
                    id: 'admin.system_users.list.memberSince',
                    defaultMessage: 'Member since',
                }),
                cell: (info) => info.getValue() || '',
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('lastLogin', {
                id: ColumnNames.lastLogin,
                header: formatMessage({
                    id: 'admin.system_users.list.lastLogin',
                    defaultMessage: 'Last login',
                }),
                cell: (info) => info.getValue() || '',
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('lastStatusAt', {
                id: ColumnNames.lastStatusAt,
                header: formatMessage({
                    id: 'admin.system_users.list.lastActivity',
                    defaultMessage: 'Last activity',
                }),
                cell: (info) => info.getValue() || '',
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('lastPostDate', {
                id: ColumnNames.lastPostDate,
                header: formatMessage({
                    id: 'admin.system_users.list.lastPost',
                    defaultMessage: 'Last post',
                }),
                cell: (info) => info.getValue() || '',
                enableHiding: true,
                enablePinning: false,
                enableSorting: true,
            }),
            columnHelper.accessor('daysActive', {
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
            columnHelper.accessor('totalPosts', {
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
                cell: (info: CellContext<AdminConsoleUserRow, null>) => {
                    return (
                        <div id={info.row.original.id}>
                            {'ROLE NOT DEFINED'}
                        </div>
                    );
                },
                enableHiding: false,
                enablePinning: true,
                enableSorting: false,
            },
        ],
        [],
    );

    const table = useReactTable({
        data: sampleData,
        columns,
        getCoreRowModel: getCoreRowModel<AdminConsoleUserRow>(),
    });

    return (
        <table
            className={classNames(
                'adminConsoleListTable',
                props.tableContainerClass,
            )}
        >
            <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <th
                                key={header.id}
                                className={classNames({
                                    sortable: header.column.getCanSort(),
                                    pinned: header.column.getCanPin(),
                                })}
                            >
                                {header.isPlaceholder ? null : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                )}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody>
                {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <td
                                key={cell.id}
                                className={classNames(
                                    `${cell.column.id}`,
                                    {
                                        pinned: cell.column.getCanPin(),
                                    },
                                )}
                            >
                                {cell.getIsPlaceholder() ? null : flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                )}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default AdminConsoleListTable;
