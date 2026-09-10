// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {GRAPH_ROW_DRAG_PREVIEW_PAD_PX} from './drag_preview';
import {GRAPH_ROW_DRAG_KIND, type GraphRowDragData} from './drop_classifier';
import * as graphUtils from './graph_utils';
import {
    applyGraphDrop,
    dropAlertFromProposeResult,
    handleMissedNativeGraphRowDrop,
    useGraphRowDnd,
} from './use_graph_row_dnd';

type DraggableConfig = {
    element: HTMLElement;
    dragHandle?: HTMLElement;
    getInitialData: () => Record<string, unknown>;
    onGenerateDragPreview: (args: {
        nativeSetDragImage: jest.Mock;
        location: {current: {input: {clientX: number; clientY: number}}};
    }) => void;
};

type DropTargetConfig = {
    element: HTMLElement;
    canDrop: (args: {source: {data: Record<string | symbol, unknown>}}) => boolean;
    onDrag: (args: {source: {data: Record<string | symbol, unknown>}}) => void;
};

const mockDraggableRegistrations: DraggableConfig[] = [];
const mockDropTargetRegistrations: DropTargetConfig[] = [];
const mockSetCustomNativeDragPreviewSpy = jest.fn();
const mockPreserveOffsetOnSourceSpy = jest.fn(() => () => ({x: 0, y: 0}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
    draggable: (config: DraggableConfig) => {
        mockDraggableRegistrations.push(config);
        return jest.fn();
    },
    dropTargetForElements: (config: DropTargetConfig) => {
        mockDropTargetRegistrations.push(config);
        return jest.fn();
    },
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/combine', () => ({
    combine: (...cleanups: Array<() => void>) => () => {
        for (const cleanup of cleanups) {
            cleanup();
        }
    },
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview', () => ({
    setCustomNativeDragPreview: (args: unknown) => {
        mockSetCustomNativeDragPreviewSpy(args);
    },
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source', () => ({
    preserveOffsetOnSource: (...args: unknown[]) => mockPreserveOffsetOnSourceSpy(...args),
}));

const opt = (name: string, parents: string[] = []): PropertyFieldOption => ({id: '', name, parents});

const g6 = [
    opt('R'),
    opt('C', ['R']),
    opt('D', ['C', 'S']),
    opt('S'),
];
const cAtR: GraphRowDragData = {kind: GRAPH_ROW_DRAG_KIND, optionName: 'C', parentName: 'R'};
const dAtC: GraphRowDragData = {kind: GRAPH_ROW_DRAG_KIND, optionName: 'D', parentName: 'C'};
const dAtS: GraphRowDragData = {kind: GRAPH_ROW_DRAG_KIND, optionName: 'D', parentName: 'S'};
const sRoot: GraphRowDragData = {kind: GRAPH_ROW_DRAG_KIND, optionName: 'S', parentName: null};
const rRoot: GraphRowDragData = {kind: GRAPH_ROW_DRAG_KIND, optionName: 'R', parentName: null};

function makeRow() {
    const row = document.createElement('li');
    row.className = 'attribute-options-graph-values__row';
    row.textContent = 'Air Operations';
    return row;
}

function graphRowEl(optionName: string, parentName: string) {
    const li = document.createElement('li');
    li.setAttribute('data-testid', 'attributeOptionsGraphRow');
    li.setAttribute('data-option-name', optionName);
    li.setAttribute('data-parent-name', parentName);
    return li;
}

describe('useGraphRowDnd drag preview', () => {
    beforeEach(() => {
        mockDraggableRegistrations.length = 0;
        mockDropTargetRegistrations.length = 0;
        mockSetCustomNativeDragPreviewSpy.mockClear();
        mockPreserveOffsetOnSourceSpy.mockClear();
    });

    test('registers the row as the draggable element and the handle as dragHandle', () => {
        const rowElement = makeRow();
        const handleElement = document.createElement('span');

        renderHookWithContext(() => useGraphRowDnd({
            rowElement,
            handleElement,
            optionName: 'Air Operations',
            parentName: null,
            options: [{id: '', name: 'Air Operations', parents: []}],
            onOptionsChange: jest.fn(),
            disabled: false,
            onDropResult: jest.fn(),
        }));

        expect(mockDraggableRegistrations).toHaveLength(1);
        expect(mockDraggableRegistrations[0].element).toBe(rowElement);
        expect(mockDraggableRegistrations[0].dragHandle).toBe(handleElement);
        expect(mockDraggableRegistrations[0].getInitialData()).toEqual({
            kind: GRAPH_ROW_DRAG_KIND,
            optionName: 'Air Operations',
            parentName: null,
        });
    });

    test('onGenerateDragPreview installs a full-row native ghost', () => {
        const rowElement = makeRow();
        jest.spyOn(rowElement, 'getBoundingClientRect').mockReturnValue({
            width: 520,
            height: 36,
            top: 0,
            left: 0,
            bottom: 36,
            right: 520,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        renderHookWithContext(() => useGraphRowDnd({
            rowElement,
            handleElement: document.createElement('span'),
            optionName: 'Air Operations',
            parentName: null,
            options: [{id: '', name: 'Air Operations', parents: []}],
            onOptionsChange: jest.fn(),
            disabled: false,
            onDropResult: jest.fn(),
        }));

        const container = document.createElement('div');
        mockSetCustomNativeDragPreviewSpy.mockImplementationOnce(({
            render,
        }: {render: (args: {container: HTMLElement}) => void}) => render({container}));

        mockDraggableRegistrations[0].onGenerateDragPreview({
            nativeSetDragImage: jest.fn(),
            location: {current: {input: {clientX: 24, clientY: 12}}},
        });

        expect(mockSetCustomNativeDragPreviewSpy).toHaveBeenCalledTimes(1);
        expect(mockPreserveOffsetOnSourceSpy).toHaveBeenCalledWith({
            element: rowElement,
            input: {clientX: 24, clientY: 12},
        });
        const previewArgs = mockSetCustomNativeDragPreviewSpy.mock.calls[0][0] as {
            getOffset: (args: {container: HTMLElement}) => {x: number; y: number};
        };
        expect(previewArgs.getOffset({container})).toEqual({
            x: GRAPH_ROW_DRAG_PREVIEW_PAD_PX,
            y: GRAPH_ROW_DRAG_PREVIEW_PAD_PX,
        });
        expect(container.querySelector('.attribute-options-graph-values--drag-preview-host')).toBeTruthy();
        expect(container.textContent).toContain('Air Operations');
        expect((container.querySelector('.attribute-options-graph-values__row') as HTMLElement).style.width).toBe('520px');
    });
});

describe('useGraphRowDnd drop-target wiring', () => {
    beforeEach(() => {
        mockDraggableRegistrations.length = 0;
        mockDropTargetRegistrations.length = 0;
    });

    function renderTarget(target: GraphRowDragData, options: PropertyFieldOption[] = g6) {
        return renderHookWithContext(() => useGraphRowDnd({
            rowElement: makeRow(),
            handleElement: document.createElement('span'),
            optionName: target.optionName,
            parentName: target.parentName,
            options,
            onOptionsChange: jest.fn(),
            disabled: false,
            onDropResult: jest.fn(),
        }));
    }

    test('canDrop is false for same occurrence and max-edges net-new', () => {
        renderTarget(dAtC);
        expect(mockDropTargetRegistrations[0].canDrop({source: {data: dAtC}})).toBe(false);

        const spy = jest.spyOn(graphUtils, 'wouldExceedMaxEdges').mockReturnValue(true);
        try {
            mockDropTargetRegistrations.length = 0;
            renderTarget(rRoot, [opt('S'), opt('R')]);
            expect(mockDropTargetRegistrations[0].canDrop({source: {data: sRoot}})).toBe(false);
        } finally {
            spy.mockRestore();
        }
    });

    test('canDrop is true for descendant and self-via-other-occurrence', () => {
        renderTarget(dAtS);
        expect(mockDropTargetRegistrations[0].canDrop({source: {data: cAtR}})).toBe(true);
        expect(mockDropTargetRegistrations[0].canDrop({source: {data: dAtC}})).toBe(true);
    });

    test('onDrag highlights only a legal reparent', () => {
        const {result, rerender} = renderTarget(sRoot);
        mockDropTargetRegistrations[0].onDrag({source: {data: cAtR}});
        rerender();
        expect(result.current.isOver).toBe(true);

        mockDropTargetRegistrations.length = 0;
        const descendant = renderTarget(dAtS);
        mockDropTargetRegistrations[0].onDrag({source: {data: cAtR}});
        descendant.rerender();
        expect(descendant.result.current.isOver).toBe(false);
    });
});

describe('applyGraphDrop', () => {
    test('legal replace applies without confirmGrant for a leaf', async () => {
        const confirmGrant = jest.fn();
        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();

        await applyGraphDrop({
            sourceData: cAtR,
            target: sRoot,
            options: g6,
            confirmGrant,
            onOptionsChange,
            onDropResult,
        });

        expect(confirmGrant).not.toHaveBeenCalled();
        expect(onOptionsChange).toHaveBeenCalledTimes(1);
        const next = onOptionsChange.mock.calls[0][0] as PropertyFieldOption[];
        expect(next.find((option) => option.name === 'C')?.parents).toEqual(['S']);
        expect(onDropResult).toHaveBeenCalledWith(expect.objectContaining({status: 'applied'}), {childName: 'C', parentName: 'S'});
    });

    test('descendant synthesizes cycle invalid without mutating', async () => {
        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();

        await applyGraphDrop({
            sourceData: cAtR,
            target: dAtS,
            options: g6,
            confirmGrant: jest.fn(),
            onOptionsChange,
            onDropResult,
        });

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(onDropResult).toHaveBeenCalledWith(
            {status: 'invalid', check: {ok: false, error: 'cycle'}},
            {childName: 'C', parentName: 'D'},
        );
    });

    test('self does not mutate and does not call onDropResult', async () => {
        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();

        await applyGraphDrop({
            sourceData: dAtC,
            target: dAtS,
            options: g6,
            confirmGrant: jest.fn(),
            onOptionsChange,
            onDropResult,
        });

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(onDropResult).not.toHaveBeenCalled();
    });

    test('already-parent is noOp without mutating', async () => {
        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();

        await applyGraphDrop({
            sourceData: cAtR,
            target: rRoot,
            options: g6,
            confirmGrant: jest.fn(),
            onOptionsChange,
            onDropResult,
        });

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(onDropResult).toHaveBeenCalledWith({status: 'noOp'}, {childName: 'C', parentName: 'R'});
    });

    test('grant-needed cancel leaves the occurrence parent unchanged', async () => {
        const options = [opt('R'), opt('C', ['R']), opt('D', ['C']), opt('P')];
        const confirmGrant = jest.fn().mockResolvedValue(false);
        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();

        await applyGraphDrop({
            sourceData: cAtR,
            target: {kind: GRAPH_ROW_DRAG_KIND, optionName: 'P', parentName: null},
            options,
            confirmGrant,
            onOptionsChange,
            onDropResult,
        });

        expect(onDropResult).toHaveBeenCalledWith({status: 'cancelled'}, {childName: 'C', parentName: 'P'});
        expect(options.find((option) => option.name === 'C')?.parents).toEqual(['R']);
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    test('vs_original ancestor drop applies without confirmGrant', async () => {
        const shortcut = [
            opt('P'),
            opt('R', ['P']),
            opt('C', ['R']),
            opt('D', ['C']),
        ];
        const confirmGrant = jest.fn();
        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();

        await applyGraphDrop({
            sourceData: cAtR,
            target: {kind: GRAPH_ROW_DRAG_KIND, optionName: 'P', parentName: null},
            options: shortcut,
            confirmGrant,
            onOptionsChange,
            onDropResult,
        });

        expect(confirmGrant).not.toHaveBeenCalled();
        expect(onDropResult).toHaveBeenCalledWith(expect.objectContaining({status: 'applied'}), {childName: 'C', parentName: 'P'});
        const next = onOptionsChange.mock.calls[0][0] as PropertyFieldOption[];
        expect(next.find((option) => option.name === 'C')?.parents).toEqual(['P']);
    });
});

describe('dropAlertFromProposeResult', () => {
    test('cycle invalid maps parent D child C; self and noOp clear', () => {
        expect(dropAlertFromProposeResult(
            {status: 'invalid', check: {ok: false, error: 'cycle'}},
            {childName: 'C', parentName: 'D'},
        )).toEqual({
            check: {ok: false, error: 'cycle'},
            childName: 'C',
            parentName: 'D',
        });
        expect(dropAlertFromProposeResult(
            {status: 'invalid', check: {ok: false, error: 'self'}},
            {childName: 'D', parentName: 'D'},
        )).toBeNull();
        expect(dropAlertFromProposeResult({status: 'noOp'}, {childName: 'C', parentName: 'R'})).toBeNull();
    });
});

describe('handleMissedNativeGraphRowDrop', () => {
    afterEach(() => {
        Reflect.deleteProperty(document, 'elementsFromPoint');
    });

    function stubElementsFromPoint(stack: Element[]) {
        Object.defineProperty(document, 'elementsFromPoint', {
            configurable: true,
            value: () => stack,
        });
    }

    test('descendant under the pointer synthesizes cycle invalid without mutating', async () => {
        const dRow = graphRowEl('D', 'S');
        const honey = document.createElement('div');
        honey.setAttribute('data-pdnd-honey-pot', 'true');
        stubElementsFromPoint([honey, dRow]);

        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();
        await handleMissedNativeGraphRowDrop({
            sourceData: cAtR,
            input: {clientX: 0, clientY: 0},
            options: g6,
            confirmGrant: jest.fn(),
            onOptionsChange,
            onDropResult,
        });

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(onDropResult).toHaveBeenCalledWith(
            {status: 'invalid', check: {ok: false, error: 'cycle'}},
            {childName: 'C', parentName: 'D'},
        );
    });

    test('legal row under the pointer does not apply on a missed native drop', async () => {
        stubElementsFromPoint([graphRowEl('S', '')]);

        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();
        await handleMissedNativeGraphRowDrop({
            sourceData: cAtR,
            input: {clientX: 0, clientY: 0},
            options: g6,
            confirmGrant: jest.fn(),
            onOptionsChange,
            onDropResult,
        });

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(onDropResult).not.toHaveBeenCalled();
    });
});
