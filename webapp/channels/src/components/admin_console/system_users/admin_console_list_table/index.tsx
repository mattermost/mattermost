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
import moment from 'moment';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import {imageURLForUser} from 'utils/utils';

import {userReports} from './sample';

import SystemUsersActions from '../system_users_list_actions';

import './index.scss';

type Props = {
    tableId?: string;
    tableContainerClass?: string;
};

export type AdminConsoleUserRow = {
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

const columnHelper = createColumnHelper<AdminConsoleUserRow>();

function AdminConsoleListTable(props: Props) {
    const {formatMessage} = useIntl();

    const todayMoment = moment();

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
                cell: (info) => {
                    const createAtMoment = info.getValue() ? moment(info.getValue()) : null;
                    if (!createAtMoment) {
                        return '';
                    }

                    const differenceInDays = todayMoment.diff(
                        createAtMoment,
                        'days',
                    );
                    const createAtDate = createAtMoment.format(
                        'MMM DD, YYYY h:mm A',
                    );

                    if (differenceInDays < 1) {
                        return (
                            <span title={createAtDate}>
                                <FormattedMessage
                                    id='admin.system_users.list.memberSince.today'
                                    defaultMessage='Today'
                                />
                            </span>
                        );
                    }
                    if (differenceInDays === 1) {
                        return (
                            <span title={createAtDate}>
                                <FormattedMessage
                                    id='admin.system_users.list.memberSince.yesterday'
                                    defaultMessage='Yesterday'
                                />
                            </span>
                        );
                    }
                    return (
                        <span title={createAtDate}>
                            {formatMessage(
                                {
                                    id: 'admin.system_users.list.memberSince.days',
                                    defaultMessage: '{days} days',
                                },
                                {days: differenceInDays},
                            )}
                        </span>
                    );
                },
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
                cell: (info) => info.getValue() || '',
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
                cell: (info) => info.getValue() || '',
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
                cell: (info) => info.getValue() || '',
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
                cell: (info: CellContext<AdminConsoleUserRow, null>) => (
                    <SystemUsersActions
                        rowIndex={info.cell.row.index}
                        tableId={props.tableId}
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

    const table = useReactTable({
        data: userReports,
        columns,
        getCoreRowModel: getCoreRowModel<AdminConsoleUserRow>(),
    });

    return (
        <table
            id={props.tableId}
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
                                id={`cell-${props.tableId}-${cell.row.index}-${cell.column.id}`}
                                className={classNames(`${cell.column.id}`, {
                                    pinned: cell.column.getCanPin(),
                                })}
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
