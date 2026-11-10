// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, useReactTable} from '@tanstack/react-table';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {ListTable, LoadingStates} from './list_table';
import type {TableMeta} from './list_table';

// PDND is exercised through dedicated hook tests. Stub it here so the
// keyboard-reorder and accessibility paths (the only behavior owned by
// ListTable itself) can be asserted without spinning up the real
// drag-and-drop wiring.
jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
    draggable: () => () => undefined,
    dropTargetForElements: () => () => undefined,
    monitorForElements: () => () => undefined,
}));
jest.mock('@atlaskit/pragmatic-drag-and-drop/combine', () => ({
    combine: () => () => undefined,
}));
jest.mock('@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview', () => ({
    setCustomNativeDragPreview: () => undefined,
}));
jest.mock('@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge', () => ({
    attachClosestEdge: (data: Record<string, unknown>) => data,
    extractClosestEdge: () => null,
}));
jest.mock('@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box', () => ({
    DropIndicator: () => null,
}));

type Row = {id: string; name: string};

const columnHelper = createColumnHelper<Row>();
const columns = [
    columnHelper.accessor('name', {
        id: 'name',
        header: 'Name',
        cell: (info) => info.getValue(),
    }),
];

type HarnessProps = {
    rows: Row[];
    onReorder?: TableMeta['onReorder'];
    isRowDragDisabled?: TableMeta['isRowDragDisabled'];
    onRowClick?: TableMeta['onRowClick'];
};

function Harness({rows, onReorder, isRowDragDisabled, onRowClick}: HarnessProps) {
    const meta: TableMeta = {
        tableId: 'test-table',
        loadingState: LoadingStates.Loaded,
        onReorder,
        isRowDragDisabled,
        onRowClick,
        disablePaginationControls: true,
    };

    const table = useReactTable<Row>({
        data: rows,
        columns,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel<Row>(),
        meta,
    });

    return <ListTable table={table}/>;
}

function makeRows(n: number): Row[] {
    return Array.from({length: n}, (_, i) => ({id: `r${i}`, name: `Row ${i}`}));
}

describe('ListTable', () => {
    describe('drag handle rendering', () => {
        test('does not render any drag handle when onReorder is omitted', () => {
            renderWithContext(<Harness rows={makeRows(3)}/>);

            expect(screen.queryAllByRole('button', {name: /reorder row/i})).toHaveLength(0);
        });

        test('renders an enabled drag handle button for every row when onReorder is set', () => {
            renderWithContext(
                <Harness
                    rows={makeRows(3)}
                    onReorder={jest.fn()}
                />,
            );

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            expect(handles).toHaveLength(3);
        });

        test('renders the disabled placeholder span (and no button) for rows where isRowDragDisabled returns true', () => {
            const {container} = renderWithContext(
                <Harness
                    rows={makeRows(3)}
                    onReorder={jest.fn()}
                    isRowDragDisabled={(rowId) => rowId === 'r0'}
                />,
            );

            // Two interactive handles (rows 1 and 2), one disabled placeholder (row 0).
            expect(screen.getAllByRole('button', {name: /reorder row/i})).toHaveLength(2);
            expect(container.querySelectorAll('.dragHandle--disabled')).toHaveLength(1);
        });
    });

    describe('keyboard reorder (ArrowUp / ArrowDown)', () => {
        test('ArrowDown on a middle row dispatches onReorder(index, index + 1)', async () => {
            const onReorder = jest.fn();
            renderWithContext(
                <Harness
                    rows={makeRows(4)}
                    onReorder={onReorder}
                />,
            );

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[1].focus();
            await userEvent.keyboard('{ArrowDown}');

            expect(onReorder).toHaveBeenCalledTimes(1);
            expect(onReorder).toHaveBeenCalledWith(1, 2);
        });

        test('ArrowUp on a middle row dispatches onReorder(index, index - 1)', async () => {
            const onReorder = jest.fn();
            renderWithContext(
                <Harness
                    rows={makeRows(4)}
                    onReorder={onReorder}
                />,
            );

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[2].focus();
            await userEvent.keyboard('{ArrowUp}');

            expect(onReorder).toHaveBeenCalledTimes(1);
            expect(onReorder).toHaveBeenCalledWith(2, 1);
        });

        test('ArrowUp on the first row is a no-op (lower bound)', async () => {
            const onReorder = jest.fn();
            renderWithContext(
                <Harness
                    rows={makeRows(3)}
                    onReorder={onReorder}
                />,
            );

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[0].focus();
            await userEvent.keyboard('{ArrowUp}');

            expect(onReorder).not.toHaveBeenCalled();
        });

        test('ArrowDown on the last row is a no-op (upper bound)', async () => {
            const onReorder = jest.fn();
            renderWithContext(
                <Harness
                    rows={makeRows(3)}
                    onReorder={onReorder}
                />,
            );

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[2].focus();
            await userEvent.keyboard('{ArrowDown}');

            expect(onReorder).not.toHaveBeenCalled();
        });

        test('non-arrow keys do not dispatch onReorder', async () => {
            const onReorder = jest.fn();
            renderWithContext(
                <Harness
                    rows={makeRows(3)}
                    onReorder={onReorder}
                />,
            );

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[1].focus();
            await userEvent.keyboard('{Enter}{Space}a');

            expect(onReorder).not.toHaveBeenCalled();
        });
    });

    describe('drag-handle click isolation', () => {
        test('clicking the drag handle does not bubble into the row onRowClick', async () => {
            const onReorder = jest.fn();
            const onRowClick = jest.fn();

            renderWithContext(
                <Harness
                    rows={makeRows(2)}
                    onReorder={onReorder}
                    onRowClick={onRowClick}
                />,
            );

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            await userEvent.click(handles[0]);

            expect(onRowClick).not.toHaveBeenCalled();
        });
    });
});
