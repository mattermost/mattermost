// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as graphUtils from './graph_utils';
import {
    canDropOnGraphRow,
    canReparentGraphRow,
    dropAlertFromProposeResult,
    dropWouldAddNetNewEdge,
    GRAPH_ROW_DRAG_KIND,
    graphRowDragDataAtPoint,
    handleGraphRowDrop,
    handleMissedNativeGraphRowDrop,
    isGraphRowDragData,
    isSameGraphOccurrence,
    type GraphRowDragData,
} from './use_graph_dnd';

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

describe('isGraphRowDragData', () => {
    test('accepts a root occurrence payload', () => {
        expect(isGraphRowDragData({kind: 'graph-row', optionName: 'C', parentName: null})).toBe(true);
    });

    test('accepts a child occurrence payload', () => {
        expect(isGraphRowDragData({kind: 'graph-row', optionName: 'C', parentName: 'R'})).toBe(true);
    });

    test('rejects missing kind, board-chip kind, and non-string optionName', () => {
        expect(isGraphRowDragData({optionName: 'C', parentName: null})).toBe(false);
        expect(isGraphRowDragData({kind: 'board-option-chip:x', optionName: 'C', parentName: null})).toBe(false);
        expect(isGraphRowDragData({kind: 'graph-row', optionName: 1, parentName: null})).toBe(false);
    });
});

describe('isSameGraphOccurrence', () => {
    test('true only for the same option+parent pair; dual occurrences differ', () => {
        expect(isSameGraphOccurrence(dAtC, dAtC)).toBe(true);
        expect(isSameGraphOccurrence(dAtC, dAtS)).toBe(false);
    });
});

describe('canDropOnGraphRow', () => {
    test('same occurrence is false', () => {
        expect(canDropOnGraphRow(dAtC, dAtC, g6)).toBe(false);
    });

    test('other kind is false', () => {
        expect(canDropOnGraphRow({kind: 'board-option-chip:x', optionName: 'C', parentName: 'R'}, sRoot, g6)).toBe(false);
    });

    test('descendant and self-via-other-occurrence still true so onDrop can alert', () => {
        expect(canDropOnGraphRow(cAtR, dAtS, g6)).toBe(true);
        expect(canDropOnGraphRow(dAtC, dAtS, g6)).toBe(true);
    });

    test('max-edges disables net-new only', () => {
        const spy = jest.spyOn(graphUtils, 'wouldExceedMaxEdges').mockReturnValue(true);
        try {
            expect(canDropOnGraphRow(sRoot, rRoot, [opt('S'), opt('R')])).toBe(false);
            expect(canDropOnGraphRow(cAtR, sRoot, g6)).toBe(true);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('canReparentGraphRow', () => {
    test('legal drop onto another root is true', () => {
        expect(canReparentGraphRow(cAtR, sRoot, g6)).toBe(true);
    });

    test('illegal descendant is false on both D occurrences', () => {
        expect(canReparentGraphRow(cAtR, dAtS, g6)).toBe(false);
        expect(canReparentGraphRow(cAtR, dAtC, g6)).toBe(false);
    });

    test('self via another occurrence is false', () => {
        expect(canReparentGraphRow(dAtC, dAtS, g6)).toBe(false);
    });

    test('current parent is a legal highlight (G4 noOp later)', () => {
        expect(canReparentGraphRow(cAtR, rRoot, g6)).toBe(true);
    });
});

describe('dropWouldAddNetNewEdge', () => {
    test('root gaining a parent is net-new; replace and already-parent are not', () => {
        expect(dropWouldAddNetNewEdge(g6, 'S', null, 'R')).toBe(true);
        expect(dropWouldAddNetNewEdge(g6, 'C', 'R', 'S')).toBe(false);
        expect(dropWouldAddNetNewEdge(g6, 'D', 'C', 'S')).toBe(false);
    });
});

describe('handleGraphRowDrop', () => {
    test('legal replace applies without confirmGrant for a leaf', async () => {
        const confirmGrant = jest.fn();
        const onOptionsChange = jest.fn();
        const onDropResult = jest.fn();

        await handleGraphRowDrop({
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

        await handleGraphRowDrop({
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

        await handleGraphRowDrop({
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

        await handleGraphRowDrop({
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

        await handleGraphRowDrop({
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

        await handleGraphRowDrop({
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

function graphRowEl(optionName: string, parentName: string) {
    const li = document.createElement('li');
    li.setAttribute('data-testid', 'attributeOptionsGraphRow');
    li.setAttribute('data-option-name', optionName);
    li.setAttribute('data-parent-name', parentName);
    return li;
}

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

        expect(graphRowDragDataAtPoint(0, 0)).toEqual(dAtS);

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
