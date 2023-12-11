// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Table, RowData} from '@tanstack/react-table';
import {flexRender} from '@tanstack/react-table';
import classNames from 'classnames';
import type {ReactNode} from 'react';
import React from 'react';

import AdminConsoleListTablePagination from './components/pagination';
import './admin_console_list_table.scss';

declare module '@tanstack/table-core' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        isNumeric?: boolean;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends RowData> {
        paginationDescription?: ReactNode;
        isFirstPage: boolean;
        isLastPage: boolean;
        onPreviousPageClick: () => void;
        onNextPageClick: () => void;
    }
}

type Props<TableType> = {
    tableId: string;
    tableAriaDescribedBy?: string;
    table: Table<TableType>;
    tableContainerClass?: string;
    countSelector?: ReactNode;
};

function AdminConsoleListTable<TableType>(props: Props<TableType>) {
    const SORTABLE_CLASS = 'sortable';
    const PINNED_CLASS = 'pinned';
    const IS_NUMERIC_CLASS = 'isNumeric';

    return (
        <>
            <table
                id={props.tableId}
                aria-describedby={`${props.tableAriaDescribedBy}`}
                className={classNames(
                    'adminConsoleListTable',
                    props.tableContainerClass,
                )}
            >
                <thead>
                    {props.table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    id={header.id}
                                    colSpan={header.colSpan}
                                    scope='col'
                                    className={classNames({
                                        [SORTABLE_CLASS]:
                                            header.column.getCanSort(),
                                        [PINNED_CLASS]:
                                            header.column.getCanPin(),
                                        [IS_NUMERIC_CLASS]:
                                            header.column.columnDef?.meta?.
                                                isNumeric || false,
                                    })}
                                    onClick={header.column.getToggleSortingHandler()}
                                >
                                    {header.isPlaceholder ? null : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext(),
                                    )}
                                    {header.column.getIsSorted() === 'asc' && (
                                        <span className='icon icon-arrow-up'/>
                                    )}
                                    {header.column.getIsSorted() === 'desc' && (
                                        <span className='icon icon-arrow-down'/>
                                    )}
                                    {header.column.getCanSort() &&
                                        header.column.getIsSorted() !== 'asc' &&
                                        header.column.getIsSorted() !== 'desc' && (
                                        <span className='icon icon-arrow-down hoverDownIcon'/>
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {props.table.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                                <td
                                    key={cell.id}
                                    id={`cell-${props.tableId}-${cell.row.index}-${cell.column.id}`}
                                    className={classNames(`${cell.column.id}`, {
                                        [PINNED_CLASS]: cell.column.getCanPin(),
                                        [IS_NUMERIC_CLASS]:
                                            cell.column.columnDef?.meta?.
                                                isNumeric || false,
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
                <tfoot>
                    {props.table.getFooterGroups().map((footerGroup) => (
                        <tr key={footerGroup.id}>
                            {footerGroup.headers.map((footer) => (
                                <th
                                    key={footer.id}
                                    colSpan={footer.colSpan}
                                    className={classNames({
                                        [PINNED_CLASS]:
                                            footer.column.getCanPin(),
                                    })}
                                >
                                    {footer.isPlaceholder ? null : flexRender(
                                        footer.column.columnDef.footer,
                                        footer.getContext(),
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </tfoot>
            </table>
            <div className='tfoot'>
                <div>{props.countSelector}</div>
                <AdminConsoleListTablePagination
                    paginationDescription={
                        props.table.options?.meta?.paginationDescription
                    }
                    isFirstPage={props.table.options?.meta?.isFirstPage}
                    isLastPage={props.table.options?.meta?.isLastPage}
                    onPreviousPageClick={
                        props.table.options?.meta?.onPreviousPageClick
                    }
                    onNextPageClick={props.table.options?.meta?.onNextPageClick}
                />
            </div>
        </>
    );
}

export default AdminConsoleListTable;
