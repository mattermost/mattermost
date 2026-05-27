// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {flexRender} from '@tanstack/react-table';
import type {SortDirection, Table, Row} from '@tanstack/react-table';
import classNames from 'classnames';
import React, {useMemo, useState} from 'react';
import type {AriaAttributes, KeyboardEvent, MouseEvent, ReactNode} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import ReactSelect, {components} from 'react-select';
import type {IndicatorsContainerProps, OnChangeValue} from 'react-select';

import {DragVerticalIcon} from '@mattermost/compass-icons/components';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {useListTableDnd} from './hooks/use_list_table_dnd';
import {useListTableRowDnd} from './hooks/use_list_table_row_dnd';
import {Pagination} from './pagination';
import {RowDropIndicator} from './row_drop_indicator';

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
    onReorder?: (prev: number, next: number) => void;
    isRowDragDisabled?: (rowId: string) => boolean;

    // Optional: returns a detached HTMLElement used as the native drag
    // preview when a row is being dragged. If omitted, the browser uses the
    // dragged row element itself, which can be visually noisy for wide
    // tables. Consumers build their own preview DOM so styling stays
    // scoped to the consuming screen (not the shared list-table primitive).
    getRowDragPreview?: (rowId: string) => HTMLElement | undefined;
    disablePrevPage?: boolean;
    disableNextPage?: boolean;
    disablePaginationControls?: boolean;
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

type DraggableRowProps<T extends TableMandatoryTypes> = {
    row: Row<T>;
    totalRows: number;
    tableMeta: TableMeta;
    rowIdPrefix: string;
    cellIdPrefix: string;
    headerIdPrefix: string;
    handleRowClick: (e: MouseEvent<HTMLTableRowElement>) => void;
};

function DraggableRow<T extends TableMandatoryTypes>({
    row,
    totalRows,
    tableMeta,
    rowIdPrefix,
    cellIdPrefix,
    headerIdPrefix,
    handleRowClick,
}: DraggableRowProps<T>) {
    const {formatMessage} = useIntl();
    const [rowElement, setRowElement] = useState<HTMLElement | null>(null);
    const [handleElement, setHandleElement] = useState<HTMLElement | null>(null);

    const dragEnabled =
        Boolean(tableMeta.onReorder) &&
        tableMeta.isRowDragDisabled?.(row.original.id) !== true;

    const dragKind = `list-table-row:${tableMeta.tableId}`;

    const {closestEdge} = useListTableRowDnd({
        dragKind,
        rowId: row.original.id,
        rowIndex: row.index,
        rowElement,
        handleElement,
        enabled: dragEnabled,
        getDragPreview: () => tableMeta.getRowDragPreview?.(row.original.id),
    });

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (row.index > 0) {
                tableMeta.onReorder?.(row.index, row.index - 1);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (row.index < totalRows - 1) {
                tableMeta.onReorder?.(row.index, row.index + 1);
            }
        }
    };

    return (
        <tr
            ref={setRowElement}
            id={`${rowIdPrefix}${row.original.id}`}
            key={row.id}
            onClick={handleRowClick}
            className={classNames({clickable: Boolean(tableMeta.onRowClick)})}
        >
            {row.getVisibleCells().map((cell, i) => (
                <td
                    key={cell.id}
                    id={`${cellIdPrefix}${cell.id}`}
                    headers={`${headerIdPrefix}${cell.column.id}`}
                    className={classNames(`${cell.column.id}`, {
                        [PINNED_CLASS]: cell.column.getCanPin(),
                    })}
                    style={{width: cell.column.getSize()}}
                >
                    {tableMeta.onReorder && i === 0 && (
                        tableMeta.isRowDragDisabled?.(row.original.id) === true ? (
                            <span className='dragHandle dragHandle--disabled'/>
                        ) : (
                            <button
                                ref={setHandleElement}
                                type='button'
                                className='dragHandle'
                                aria-label={formatMessage({
                                    id: 'adminConsole.list.table.dragHandleLabel',
                                    defaultMessage: 'Reorder row',
                                })}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={handleKeyDown}
                            >
                                <DragVerticalIcon size={18}/>
                            </button>
                        )
                    )}
                    {cell.getIsPlaceholder() ? null : flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
            ))}
            {closestEdge && rowElement && (
                <RowDropIndicator
                    rowElement={rowElement}
                    edge={closestEdge}
                />
            )}
        </tr>
    );
}

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

    const hasPagination = !tableMeta.disablePaginationControls;

    const pageSizeOptions = useMemo(() => {
        return PAGE_SIZES.map((size) => {
            return {
                label: formatMessage(PageSizes[size]),
                value: size,
            };
        });
    }, []);

    const selectedPageSize = pageSizeOptions.find((option) => option.value === props.table.getState().pagination.pageSize) || pageSizeOptions[0];

    function handlePageSizeChange(selectedOption: OnChangeValue<PageSizeOption, false>) {
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

    useListTableDnd({
        dragKind: `list-table-row:${tableMeta.tableId}`,
        onReorder: tableMeta.onReorder,
    });

    const colCount = props.table.getAllColumns().length;
    const rowCount = props.table.getRowModel().rows.length;

    return (
        <div className='adminConsoleListTableContainer'>
            {hasPagination && (
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
            )}
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
                                    style={{width: header.column.getSize()}}
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
                    {props.table.getRowModel().rows.map((row, _, rows) => (
                        <DraggableRow
                            key={row.original.id}
                            row={row}
                            totalRows={rows.length}
                            tableMeta={tableMeta}
                            rowIdPrefix={rowIdPrefix}
                            cellIdPrefix={cellIdPrefix}
                            headerIdPrefix={headerIdPrefix}
                            handleRowClick={handleRowClick}
                        />
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
            {hasPagination && (
                <div className='adminConsoleListTabletOptionalFoot'>
                    {tableMeta.paginationInfo}
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
                    <Pagination
                        disablePrevPage={tableMeta.disablePrevPage}
                        disableNextPage={tableMeta.disableNextPage}
                        isLoading={tableMeta.loadingState === LoadingStates.Loading}
                        onPreviousPageClick={tableMeta.onPreviousPageClick}
                        onNextPageClick={tableMeta.onNextPageClick}
                    />

                </div>
            )}
        </div>
    );
}

function IndicatorsContainer(props: IndicatorsContainerProps<PageSizeOption>) {
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
