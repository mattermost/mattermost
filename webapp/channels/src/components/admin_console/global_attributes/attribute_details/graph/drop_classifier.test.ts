// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {
    classifyGraphDrop,
    GRAPH_ROW_DRAG_KIND,
    isGraphRowDragData,
    type GraphDropKind,
    type GraphRowDragData,
} from './drop_classifier';
import * as graphUtils from './graph_utils';

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

describe('classifyGraphDrop', () => {
    test('same occurrence is ignore', () => {
        expect(classifyGraphDrop(dAtC, dAtC, g6)).toBe('ignore');
    });

    test('self via another occurrence is ignore, not same occ', () => {
        expect(classifyGraphDrop(dAtC, dAtS, g6)).toBe('ignore');
    });

    test('other kind is ignore', () => {
        expect(classifyGraphDrop({kind: 'board-option-chip:x', optionName: 'C', parentName: 'R'}, sRoot, g6)).toBe('ignore');
    });

    test('descendant is alert-cycle so onDrop can alert', () => {
        expect(classifyGraphDrop(cAtR, dAtS, g6)).toBe('alert-cycle');
        expect(classifyGraphDrop(cAtR, dAtC, g6)).toBe('alert-cycle');
    });

    test('legal drop onto another root is reparent', () => {
        expect(classifyGraphDrop(cAtR, sRoot, g6)).toBe('reparent');
    });

    test('current parent is reparent (G4 noOp later)', () => {
        expect(classifyGraphDrop(cAtR, rRoot, g6)).toBe('reparent');
    });

    test('max-edges disables net-new only', () => {
        const spy = jest.spyOn(graphUtils, 'wouldExceedMaxEdges').mockReturnValue(true);
        try {
            expect(classifyGraphDrop(sRoot, rRoot, [opt('S'), opt('R')])).toBe('blocked-max-edges');
            expect(classifyGraphDrop(cAtR, sRoot, g6)).toBe('reparent');
        } finally {
            spy.mockRestore();
        }
    });

    test('net-new under the limit is reparent', () => {
        expect(classifyGraphDrop(sRoot, rRoot, g6)).toBe('reparent');
    });

    test.each<[string, GraphRowDragData, GraphRowDragData, GraphDropKind]>([
        ['same occurrence', dAtC, dAtC, 'ignore'],
        ['self via other occurrence', dAtC, dAtS, 'ignore'],
        ['descendant at S', cAtR, dAtS, 'alert-cycle'],
        ['descendant at C', cAtR, dAtC, 'alert-cycle'],
        ['legal reparent onto S', cAtR, sRoot, 'reparent'],
        ['already-parent onto R', cAtR, rRoot, 'reparent'],
        ['net-new root onto R under limit', sRoot, rRoot, 'reparent'],
    ])('%s', (_label, source, target, kind) => {
        expect(classifyGraphDrop(source, target, g6)).toBe(kind);
    });
});
