// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHookWithContext} from 'tests/react_testing_utils';

import {GRAPH_ROW_DRAG_KIND, GRAPH_ROW_DRAG_PREVIEW_PAD_PX, useGraphRowDnd} from './use_graph_dnd';

type DraggableConfig = {
    element: HTMLElement;
    dragHandle?: HTMLElement;
    getInitialData: () => Record<string, unknown>;
    onGenerateDragPreview: (args: {
        nativeSetDragImage: jest.Mock;
        location: {current: {input: {clientX: number; clientY: number}}};
    }) => void;
};

const mockDraggableRegistrations: DraggableConfig[] = [];
const mockSetCustomNativeDragPreviewSpy = jest.fn();
const mockPreserveOffsetOnSourceSpy = jest.fn(() => () => ({x: 0, y: 0}));

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
    draggable: (config: DraggableConfig) => {
        mockDraggableRegistrations.push(config);
        return jest.fn();
    },
    dropTargetForElements: () => jest.fn(),
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
    preserveOffsetOnSource: mockPreserveOffsetOnSourceSpy,
}));

function makeRow() {
    const row = document.createElement('li');
    row.className = 'attribute-options-graph-values__row';
    row.textContent = 'Air Operations';
    return row;
}

describe('useGraphRowDnd drag preview', () => {
    beforeEach(() => {
        mockDraggableRegistrations.length = 0;
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
