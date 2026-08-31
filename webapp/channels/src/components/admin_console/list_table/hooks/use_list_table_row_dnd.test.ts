// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useListTableRowDnd} from './use_list_table_row_dnd';

type DraggableConfig = {
    element: HTMLElement;
    dragHandle?: HTMLElement;
    getInitialData: () => Record<string, unknown>;
    onGenerateDragPreview: (args: {nativeSetDragImage: jest.Mock}) => void;
};

type DropTargetConfig = {
    element: HTMLElement;
    canDrop: (args: {source: {data: Record<string, unknown>}}) => boolean;
    getData: (args: {input: unknown; element: HTMLElement}) => Record<string, unknown>;
    onDrag: (args: {self: {data: Record<string, unknown>}}) => void;
    onDragLeave: () => void;
    onDrop: () => void;
};

// Capture PDND registrations so tests can drive their callbacks directly —
// PDND only fires these from real HTML5 drag events, which jsdom doesn't
// dispatch.
//
// Names are intentionally `mock`-prefixed: babel-plugin-jest-hoist hoists
// `jest.mock(...)` calls to the top of the module and only allows the
// factory to reference identifiers whose name matches `/^mock/i`.
const mockDraggableRegistrations: DraggableConfig[] = [];
const mockDropTargetRegistrations: DropTargetConfig[] = [];
const mockCleanupSpies: jest.Mock[] = [];

let mockNextExtractedEdge: 'top' | 'bottom' | null = 'bottom';
const mockSetCustomNativeDragPreviewSpy = jest.fn();

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
    draggable: (config: DraggableConfig) => {
        mockDraggableRegistrations.push(config);
        const cleanup = jest.fn();
        mockCleanupSpies.push(cleanup);
        return cleanup;
    },
    dropTargetForElements: (config: DropTargetConfig) => {
        mockDropTargetRegistrations.push(config);
        const cleanup = jest.fn();
        mockCleanupSpies.push(cleanup);
        return cleanup;
    },
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/combine', () => ({
    combine: (...cleanups: Array<() => void>) => {
        // `combine` in real PDND returns a single cleanup that runs all
        // inner cleanups. Match that semantics so unmount fires every
        // captured cleanup spy in order.
        return () => {
            for (const c of cleanups) {
                c();
            }
        };
    },
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview', () => ({
    setCustomNativeDragPreview: (args: unknown) => {
        mockSetCustomNativeDragPreviewSpy(args);
    },
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge', () => ({
    attachClosestEdge: (data: Record<string, unknown>) => ({...data, __edge: 'attached'}),
    extractClosestEdge: () => mockNextExtractedEdge,
}));

function makeRow() {
    return document.createElement('tr');
}

function makeHandle() {
    return document.createElement('button');
}

const baseOptions = {
    dragKind: 'list-table-row:test',
    rowId: 'row-1',
    rowIndex: 2,
    enabled: true,
} as const;

describe('useListTableRowDnd', () => {
    beforeEach(() => {
        mockDraggableRegistrations.length = 0;
        mockDropTargetRegistrations.length = 0;
        mockCleanupSpies.length = 0;
        mockSetCustomNativeDragPreviewSpy.mockClear();
        mockNextExtractedEdge = 'bottom';
    });

    test('returns {closestEdge: null} initially', () => {
        const {result} = renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement: makeRow(),
            handleElement: null,
        }));

        expect(result.current.closestEdge).toBeNull();
    });

    test('does not register when rowElement is null', () => {
        renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement: null,
            handleElement: null,
        }));

        expect(mockDraggableRegistrations).toHaveLength(0);
        expect(mockDropTargetRegistrations).toHaveLength(0);
    });

    test('does not register when enabled is false', () => {
        renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            enabled: false,
            rowElement: makeRow(),
            handleElement: makeHandle(),
        }));

        expect(mockDraggableRegistrations).toHaveLength(0);
        expect(mockDropTargetRegistrations).toHaveLength(0);
    });

    test('registers both draggable and dropTarget when enabled with a row element', () => {
        const rowElement = makeRow();
        const handleElement = makeHandle();

        renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement,
            handleElement,
        }));

        expect(mockDraggableRegistrations).toHaveLength(1);
        expect(mockDropTargetRegistrations).toHaveLength(1);

        expect(mockDraggableRegistrations[0].element).toBe(rowElement);
        expect(mockDraggableRegistrations[0].dragHandle).toBe(handleElement);

        expect(mockDraggableRegistrations[0].getInitialData()).toEqual({
            kind: baseOptions.dragKind,
            rowId: baseOptions.rowId,
            rowIndex: baseOptions.rowIndex,
        });
    });

    test('canDrop accepts other rows with the same kind and rejects the source row itself', () => {
        renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement: makeRow(),
            handleElement: null,
        }));

        const {canDrop} = mockDropTargetRegistrations[0];

        expect(canDrop({source: {data: {kind: baseOptions.dragKind, rowId: 'row-other'}}})).toBe(true);
        expect(canDrop({source: {data: {kind: baseOptions.dragKind, rowId: baseOptions.rowId}}})).toBe(false);
        expect(canDrop({source: {data: {kind: 'different-kind', rowId: 'row-other'}}})).toBe(false);
    });

    test('getData attaches the row identity together with the closest-edge payload', () => {
        renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement: makeRow(),
            handleElement: null,
        }));

        const data = mockDropTargetRegistrations[0].getData({
            input: {clientX: 0, clientY: 0},
            element: makeRow(),
        });

        expect(data).toMatchObject({
            kind: baseOptions.dragKind,
            rowId: baseOptions.rowId,
            rowIndex: baseOptions.rowIndex,
            __edge: 'attached',
        });
    });

    test('onDrag updates closestEdge; onDragLeave and onDrop reset it to null', () => {
        mockNextExtractedEdge = 'top';
        const {result} = renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement: makeRow(),
            handleElement: null,
        }));

        const target = mockDropTargetRegistrations[0];

        act(() => {
            target.onDrag({self: {data: {kind: baseOptions.dragKind}}});
        });
        expect(result.current.closestEdge).toBe('top');

        act(() => {
            target.onDragLeave();
        });
        expect(result.current.closestEdge).toBeNull();

        mockNextExtractedEdge = 'bottom';
        act(() => {
            target.onDrag({self: {data: {kind: baseOptions.dragKind}}});
        });
        expect(result.current.closestEdge).toBe('bottom');

        act(() => {
            target.onDrop();
        });
        expect(result.current.closestEdge).toBeNull();
    });

    test('unmount runs the combined cleanup so both draggable and dropTarget are torn down', () => {
        const {unmount} = renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement: makeRow(),
            handleElement: null,
        }));

        expect(mockCleanupSpies).toHaveLength(2);
        expect(mockCleanupSpies.every((s) => !s.mock.calls.length)).toBe(true);

        unmount();

        expect(mockCleanupSpies.every((s) => s.mock.calls.length === 1)).toBe(true);
    });

    test('onGenerateDragPreview installs a custom native preview only when one is provided', () => {
        const previewEl = document.createElement('div');
        previewEl.textContent = 'preview';

        renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement: makeRow(),
            handleElement: null,
            getDragPreview: () => previewEl,
        }));

        const draggable = mockDraggableRegistrations[0];
        draggable.onGenerateDragPreview({nativeSetDragImage: jest.fn()});

        expect(mockSetCustomNativeDragPreviewSpy).toHaveBeenCalledTimes(1);
    });

    test('onGenerateDragPreview is a no-op when getDragPreview returns nothing', () => {
        renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement: makeRow(),
            handleElement: null,
            getDragPreview: () => undefined,
        }));

        const draggable = mockDraggableRegistrations[0];
        draggable.onGenerateDragPreview({nativeSetDragImage: jest.fn()});

        expect(mockSetCustomNativeDragPreviewSpy).not.toHaveBeenCalled();
    });

    test('ghost reads the latest getDragPreview after a re-render without re-registering (regression: stale preview on a renamed new row)', () => {
        const stalePreview = document.createElement('div');
        stalePreview.textContent = 'Text';
        const latestPreview = document.createElement('div');
        latestPreview.textContent = 'Priority';

        // Stable deps; only the preview closure changes (a renamed new row).
        const rowElement = makeRow();
        let getDragPreview = () => stalePreview;

        const {rerender} = renderHookWithContext(() => useListTableRowDnd({
            ...baseOptions,
            rowElement,
            handleElement: null,
            getDragPreview,
        }));

        getDragPreview = () => latestPreview;
        rerender();

        expect(mockDraggableRegistrations).toHaveLength(1);

        const container = document.createElement('div');
        mockSetCustomNativeDragPreviewSpy.mockImplementationOnce(({render}: {render: (a: {container: HTMLElement}) => void}) => render({container}));
        mockDraggableRegistrations[0].onGenerateDragPreview({nativeSetDragImage: jest.fn()});

        // Without the ref this would be the captured 'Text' preview.
        expect(container.textContent).toBe('Priority');
    });
});
