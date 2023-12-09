// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ColumnDef, getCoreRowModel} from '@tanstack/react-table';
import {
    useReactTable,
    flexRender,
} from '@tanstack/react-table';
import classNames from 'classnames';
import React from 'react';

import './admin_console_list_table.scss';

type Props<TableType> = {
    tableId: string;
    tableContainerClass?: string;
    getCoreRowModel: typeof getCoreRowModel;
    columns: Array<ColumnDef<TableType, any>>;
    data: TableType[];
};

function AdminConsoleListTable<TableType>(props: Props<TableType>) {
    const table = useReactTable({
        data: props.data,
        columns: props.columns,
        getCoreRowModel: props.getCoreRowModel<TableType>(),
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
