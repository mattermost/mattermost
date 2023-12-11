// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Table} from '@tanstack/react-table';
import {flexRender} from '@tanstack/react-table';
import classNames from 'classnames';
import React, {useMemo} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import ReactSelect, {components} from 'react-select';
import type {IndicatorContainerProps, ValueType} from 'react-select';

import './admin_console_list_table.scss';

const SORTABLE_CLASS = 'sortable';
const PINNED_CLASS = 'pinned';
const PAGE_SIZES = [10, 20, 50, 100];
const PageSizes = defineMessages<number>({
    10: {
        id: 'admin.console.list.table.rowsCount.10',
        defaultMessage: '10',
    },
    20: {
        id: 'admin.console.list.table.rowsCount.20',
        defaultMessage: '20',
    },
    50: {
        id: 'admin.console.list.table.rowsCount.50',
        defaultMessage: '50',
    },
    100: {
        id: 'admin.console.list.table.rowsCount.100',
        defaultMessage: '100',
    },
});

type PageSizeOption = {
    label: string;
    value: number;
};

type Props<TableType> = {
    tableId: string;
    tableAriaDescribedBy?: string;
    table: Table<TableType>;
    tableContainerClass?: string;
};

function AdminConsoleListTable<TableType>(props: Props<TableType>) {
    const {formatMessage} = useIntl();

    const pageSizeOptions = useMemo(() => {
        return PAGE_SIZES.map((size) => {
            return {
                label: formatMessage(PageSizes[size]),
                value: size,
            };
        });
    }, []);

    const selectedPageSize = pageSizeOptions.find((option) => option.value === props.table.getState().pagination.pageSize) || pageSizeOptions[0];

    function handlePageSizeChange(selectedOption: ValueType<PageSizeOption>) {
        const {value} = selectedOption as PageSizeOption;
        props.table.setPageSize(Number(value));
    }

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
                <div className='adminConsoleListTablePageSize'>
                    <FormattedMessage
                        id='admin.console.list.table.rowsCount.(show)rowsPerPage'
                        defaultMessage='Show'
                    />
                    <ReactSelect
                        className='react-select'
                        classNamePrefix='react-select'
                        autoFocus={false}
                        isClearable={false}
                        isMulti={false}
                        isSearchable={false}
                        menuPlacement='top'
                        options={pageSizeOptions}
                        value={selectedPageSize}
                        onChange={handlePageSizeChange}
                        components={{
                            IndicatorSeparator: null,
                            IndicatorsContainer: SelectIndicator,
                        }}
                    />
                    <FormattedMessage
                        id='admin.console.list.table.rowsCount.show(rowsPerPage)'
                        defaultMessage='rows per page'
                    />
                </div>
                <div className='adminConsoleListTablePagination'>
                    <button
                        className='btn btn-quaternary'
                        disabled={!props.table.getCanPreviousPage()}
                        onClick={() => props.table.previousPage()}
                    >
                        <i className='icon icon-chevron-left'/>
                    </button>
                    <button
                        className='btn btn-quaternary'
                        disabled={!props.table.getCanNextPage()}
                        onClick={() => props.table.nextPage()}
                    >
                        <i className='icon icon-chevron-right'/>
                    </button>
                </div>
            </div>
        </>
    );
}

function SelectIndicator(props: IndicatorContainerProps<PageSizeOption>) {
    return (
        <components.IndicatorsContainer {...props}>
            <i className='icon icon-chevron-down'/>
        </components.IndicatorsContainer>
    );
}

export default AdminConsoleListTable;
