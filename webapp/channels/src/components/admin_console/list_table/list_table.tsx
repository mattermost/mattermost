// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SortDirection, Table} from '@tanstack/react-table';
import {flexRender} from '@tanstack/react-table';
import classNames from 'classnames';
import React, {useMemo} from 'react';
import type {AriaAttributes, MouseEvent, ReactNode} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import ReactSelect, {components} from 'react-select';
import type {IndicatorContainerProps, ValueType} from 'react-select';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Pagination} from './pagination';

import './list_table.scss';

const SORTABLE_CLASS = 'sortable';
const PINNED_CLASS = 'pinned';

export const PAGE_SIZES = [10, 20, 50, 100];
const PageSizes = defineMessages<number>({
    10: {
        id: 'adminConsole.list.table.rowsCount.10',
        defaultMessage: '10',
    },
    20: {
        id: 'adminConsole.list.table.rowsCount.20',
        defaultMessage: '20',
    },
    50: {
        id: 'adminConsole.list.table.rowsCount.50',
        defaultMessage: '50',
    },
    100: {
        id: 'adminConsole.list.table.rowsCount.100',
        defaultMessage: '100',
    },
});

export type PageSizeOption = {
    label: string;
    value: number;
};

export enum LoadingStates {
    Loading = 'loading',
    Loaded = 'loaded',
    Failed = 'failed',
}

export type TableMeta = {
    tableId: string;
    tableCaption?: string;
    loadingState?: LoadingStates;
    emptyDataMessage?: ReactNode;
    onRowClick?: (row: string) => void;
    disablePrevPage?: boolean;
    disableNextPage?: boolean;
    onPreviousPageClick?: () => void;
    onNextPageClick?: () => void;
    paginationInfo?: ReactNode;
    hasDualSidedPagination?: boolean;
};

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
export function ListTable<TableType extends TableMandatoryTypes>(
    props: Props<TableType>,
) {
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

    const colCount = props.table.getAllColumns().length;
    const rowCount = props.table.getRowModel().rows.length;

    return (
        <div className='adminConsoleListTableContainer'>
            <div className='adminConsoleListTabletOptionalHead'>
                {tableMeta.hasDualSidedPagination && (
                    <>
                        {tableMeta.paginationInfo}
                        <Pagination
                            disablePrevPage={tableMeta.disablePrevPage}
                            disableNextPage={tableMeta.disableNextPage}
                            isLoading={tableMeta.loadingState === LoadingStates.Loading}
                            onPreviousPageClick={tableMeta.onPreviousPageClick}
                            onNextPageClick={tableMeta.onNextPageClick}
                        />
                    </>
                )}
            </div>
            <table
                id={tableMeta.tableId}
                aria-colcount={colCount}
                aria-describedby={`${tableMeta.tableId}-headerId`} // Set this id to the table header so that the title describes the table
                className={classNames(
                    'adminConsoleListTable',
                    tableMeta.tableId,
                )}
            >
                <caption className='sr-only'>{tableMeta.tableCaption}</caption>
                <thead>
                    {props.table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    id={`${headerIdPrefix}${header.id}`}
                                    colSpan={header.colSpan}
                                    scope='col'
                                    aria-sort={getAriaSortForTableHeader(header.column.getCanSort(), header.column.getIsSorted())}
                                    className={classNames(`${header.id}`, {
                                        [SORTABLE_CLASS]: header.column.getCanSort(),
                                        [PINNED_CLASS]: header.column.getCanPin(),
                                    })}
                                    disabled={header.column.getCanSort() && tableMeta.loadingState === LoadingStates.Loading}
                                    onClick={header.column.getToggleSortingHandler()}
                                >
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}

                                    {/* Sort Icons */}
                                    {header.column.getIsSorted() === 'asc' && (
                                        <span
                                            aria-hidden='true'
                                            className='icon icon-arrow-up'
                                        />
                                    )}
                                    {header.column.getIsSorted() === 'desc' && (
                                        <span
                                            aria-hidden='true'
                                            className='icon icon-arrow-down'
                                        />
                                    )}
                                    {header.column.getCanSort() &&
                                        header.column.getIsSorted() !== 'asc' &&
                                        header.column.getIsSorted() !== 'desc' && (
                                        <span
                                            aria-hidden='true'
                                            className='icon icon-arrow-up hoverSortingIcon'
                                        />
                                    )}
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

                    {/* State where it is initially loading the data */}
                    {(tableMeta.loadingState === LoadingStates.Loading && rowCount === 0) && (
                        <tr>
                            <td
                                colSpan={colCount}
                                className='noRows'
                                disabled={true}
                            >
                                <LoadingSpinner
                                    text={formatMessage({id: 'adminConsole.list.table.genericLoading', defaultMessage: 'Loading'})}
                                />
                            </td>
                        </tr>
                    )}

                    {/* State where there is no data */}
                    {(tableMeta.loadingState === LoadingStates.Loaded && rowCount === 0) && (
                        <tr>
                            <td
                                colSpan={colCount}
                                className='noRows'
                                disabled={true}
                            >
                                {tableMeta.emptyDataMessage || formatMessage({id: 'adminConsole.list.table.genericNoData', defaultMessage: 'No data'})}
                            </td>
                        </tr>
                    )}

                    {/* State where there is an error loading the data */}
                    {tableMeta.loadingState === LoadingStates.Failed && (
                        <tr>
                            <td
                                colSpan={colCount}
                                className='noRows'
                                disabled={true}
                            >
                                {formatMessage({id: 'adminConsole.list.table.genericError', defaultMessage: 'There was an error loading the data, please try again'})}
                            </td>
                        </tr>
                    )}
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
            <div className='adminConsoleListTabletOptionalFoot'>
                {tableMeta.paginationInfo}
                {handlePageSizeChange && (
                    <div
                        className='adminConsoleListTablePageSize'
                        aria-label={formatMessage({id: 'adminConsole.list.table.rowCount.label', defaultMessage: 'Show {count} rows per page'}, {count: selectedPageSize.label})}
                    >
                        <FormattedMessage
                            id='adminConsole.list.table.rowsCount.(show)rowsPerPage'
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
                            isDisabled={tableMeta.loadingState === LoadingStates.Loading}
                            components={{
                                IndicatorSeparator: null,
                                IndicatorsContainer,
                            }}
                        />
                        <FormattedMessage
                            id='adminConsole.list.table.rowsCount.show(rowsPerPage)'
                            defaultMessage='rows per page'
                        />
                    </div>
                )}
                <Pagination
                    disablePrevPage={tableMeta.disablePrevPage}
                    disableNextPage={tableMeta.disableNextPage}
                    isLoading={tableMeta.loadingState === LoadingStates.Loading}
                    onPreviousPageClick={tableMeta.onPreviousPageClick}
                    onNextPageClick={tableMeta.onNextPageClick}
                />
            </div>
        </div>
    );
}

function IndicatorsContainer(props: IndicatorContainerProps<PageSizeOption>) {
    return (
        <components.IndicatorsContainer {...props}>
            <i className='icon icon-chevron-down'/>
        </components.IndicatorsContainer>
    );
}

function getAriaSortForTableHeader(
    canSort: boolean,
    sortDirection: boolean | SortDirection,
): AriaAttributes['aria-sort'] {
    if (!canSort) {
        return undefined;
    }

    if (sortDirection === 'asc') {
        return 'ascending';
    }

    if (sortDirection === 'desc') {
        return 'descending';
    }

    return 'none';
}
