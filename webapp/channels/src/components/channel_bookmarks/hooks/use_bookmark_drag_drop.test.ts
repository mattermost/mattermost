// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useBookmarkDragDrop} from './use_bookmark_drag_drop';

const mockDraggable: jest.Mock = jest.fn(() => () => undefined);
const mockDropTargetForElements: jest.Mock = jest.fn(() => () => undefined);

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
    draggable: (arg: unknown) => mockDraggable(arg),
    dropTargetForElements: (arg: unknown) => mockDropTargetForElements(arg),
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/combine', () => ({
    combine: (...cleanups: Array<() => void>) => () => cleanups.forEach((c) => c()),
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview', () => ({
    setCustomNativeDragPreview: jest.fn(),
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/prevent-unhandled', () => ({
    preventUnhandled: {start: jest.fn(), stop: jest.fn()},
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge', () => ({
    attachClosestEdge: (data: unknown) => data,
    extractClosestEdge: () => null,
}));

describe('useBookmarkDragDrop', () => {
    beforeEach(() => {
        mockDraggable.mockClear();
        mockDropTargetForElements.mockClear();
    });

    test('does not register draggable or drop target when canReorder is false', () => {
        const element = document.createElement('div');

        renderHookWithContext(
            () => useBookmarkDragDrop({
                id: 'bm1',
                container: 'bar',
                allowedEdges: ['left', 'right'],
                displayName: 'Example',
                canReorder: false,
                element,
            }),
        );

        expect(mockDraggable).not.toHaveBeenCalled();
        expect(mockDropTargetForElements).not.toHaveBeenCalled();
    });

    test('registers draggable and drop target when canReorder is true', () => {
        const element = document.createElement('div');

        renderHookWithContext(
            () => useBookmarkDragDrop({
                id: 'bm1',
                container: 'bar',
                allowedEdges: ['left', 'right'],
                displayName: 'Example',
                canReorder: true,
                element,
            }),
        );

        expect(mockDraggable).toHaveBeenCalledTimes(1);
        expect(mockDropTargetForElements).toHaveBeenCalledTimes(1);
    });

    test('does not register when element is null even if canReorder is true', () => {
        renderHookWithContext(
            () => useBookmarkDragDrop({
                id: 'bm1',
                container: 'bar',
                allowedEdges: ['left', 'right'],
                displayName: 'Example',
                canReorder: true,
                element: null,
            }),
        );

        expect(mockDraggable).not.toHaveBeenCalled();
        expect(mockDropTargetForElements).not.toHaveBeenCalled();
    });
});
