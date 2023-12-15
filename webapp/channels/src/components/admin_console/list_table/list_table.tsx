// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Table} from '@tanstack/react-table';
import {flexRender} from '@tanstack/react-table';
import classNames from 'classnames';
import React, {useMemo} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import ReactSelect, {components} from 'react-select';
import type {IndicatorContainerProps, ValueType} from 'react-select';

import './list_table.scss';

const SORTABLE_CLASS = 'sortable';
const PINNED_CLASS = 'pinned';

export const PAGE_SIZES = [10, 20, 50, 100];
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

export type PageSizeOption = {
    label: string;
    value: number;
};

export type TableMeta = {
    tableId: string;
    isLoading?: boolean;
    onRowClick?: (row: string) => void;
    disablePrevPage?: boolean;
    disableNextPage?: boolean;
    onPreviousPageClick?: () => void;
    onNextPageClick?: () => void;
}

interface TableMandatoryTypes {
    id: string;
}

type Props<TableType extends TableMandatoryTypes> = {
    table: Table<TableType>;
};

/**
 * A wrapper around the react-table component that provides a consistent look and feel for the admin console list tables.
 * It also provides a default pagination component. This table is not meant to be used outside of the admin console since it relies on the admin console styles.
 *
 * @param {Table} table - See https://tanstack.com/table/v8/docs/api/core/table/ for more details
 */
export function ListTable<TableType extends TableMandatoryTypes>(props: Props<TableType>) {
    const {formatMessage} = useIntl();

    const tableMeta = props.table.options.meta as TableMeta;
    const headerIdPrefix = `${tableMeta.tableId}-header-`;
    const rowIdPrefix = `${tableMeta.tableId}-row-`;
    const cellIdPrefix = `${tableMeta.tableId}-cell-`;

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

    function handleRowClick(event: MouseEvent<HTMLTableRowElement>) {
        const {currentTarget: {id = ''}} = event;
        const rowOriginalId = id.replace(rowIdPrefix, '');

        if (tableMeta.onRowClick && rowOriginalId.length > 0) {
            event.preventDefault();
            tableMeta.onRowClick(rowOriginalId);
        }
    }

    return (
        <>
            <table
                id={tableMeta.tableId}
                aria-describedby={`${tableMeta.tableId}-headerId`} // Set this id to the table header so that the title describes the table
                className={classNames('adminConsoleListTable', tableMeta.tableId)}
            >
                <thead>
                    {props.table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    id={`${headerIdPrefix}${header.id}`}
                                    colSpan={header.colSpan}
                                    scope='col'
                                    className={classNames(`${header.id}`, {
                                        [SORTABLE_CLASS]: header.column.getCanSort(),
                                        [PINNED_CLASS]: header.column.getCanPin(),
                                    })}
                                    onClick={header.column.getToggleSortingHandler()}
                                >
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}

                                    {/* Sort Icons */}
                                    {header.column.getIsSorted() === 'asc' && (
                                        <span className='icon icon-arrow-up'/>
                                    )}
                                    {header.column.getIsSorted() === 'desc' && (
                                        <span className='icon icon-arrow-down'/>
                                    )}
                                    {header.column.getCanSort() &&
                                        header.column.getIsSorted() !== 'asc' &&
                                        header.column.getIsSorted() !== 'desc' && (
                                        <span className='icon icon-arrow-up hoverSortingIcon'/>
                                    )}

                                    {/* Add pinned icon here */}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {props.table.getRowModel().rows.map((row) => (
                        <tr
                            id={`${rowIdPrefix}${row.original.id}`}
                            key={row.id}
                            onClick={handleRowClick}
                        >
                            {row.getVisibleCells().map((cell) => (
                                <td
                                    key={cell.id}
                                    id={`${cellIdPrefix}${cell.id}`}
                                    headers={`${headerIdPrefix}${cell.column.id}`}
                                    className={classNames(`${cell.column.id}`, {
                                        [PINNED_CLASS]: cell.column.getCanPin(),
                                    })}
                                >
                                    {cell.getIsPlaceholder() ? null : flexRender(cell.column.columnDef.cell, cell.getContext())}
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
                                        [PINNED_CLASS]: footer.column.getCanPin(),
                                    })}
                                >
                                    {footer.isPlaceholder ? null : flexRender(footer.column.columnDef.footer, footer.getContext())}
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
                        isDisabled={tableMeta.isLoading}
                        menuIsOpen={true}
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
                    {tableMeta.onPreviousPageClick && (
                        <button
                            className='btn btn-icon btn-sm'
                            disabled={tableMeta.disablePrevPage || tableMeta.isLoading}
                            onClick={tableMeta.onPreviousPageClick}
                        >
                            <i className='icon icon-chevron-left'/>
                        </button>
                    )}
                    {tableMeta.onNextPageClick && (
                        <button
                            className='btn btn-icon btn-sm'
                            disabled={tableMeta.disablePrevPage || tableMeta.isLoading}
                            onClick={tableMeta.onNextPageClick}
                        >
                            <i className='icon icon-chevron-right'/>
                        </button>
                    )}
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
