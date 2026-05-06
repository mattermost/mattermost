// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useBookmarksDnd} from './use_bookmarks_dnd';

type MonitorConfig = {
    canMonitor: (args: {source: {data: Record<string, unknown>}}) => boolean;
    onDragStart: (args: {source: {data: Record<string, unknown>}}) => void;
    onDrop: (args: {
        source: {data: Record<string, unknown>};
        location: {current: {dropTargets: Array<{data: Record<string, unknown>}>}};
    }) => void;
    onDropTargetChange: (args: {
        location: {current: {dropTargets: Array<{data: Record<string, unknown>}>}};
    }) => void;
};

const registeredMonitors: MonitorConfig[] = [];

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
    monitorForElements: (config: MonitorConfig) => {
        registeredMonitors.push(config);
        return () => {
            const idx = registeredMonitors.indexOf(config);
            if (idx !== -1) {
                registeredMonitors.splice(idx, 1);
            }
        };
    },
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge', () => ({
    extractClosestEdge: () => null,
}));

function dropTargets(...targets: Array<Record<string, unknown>>) {
    return {current: {dropTargets: targets.map((data) => ({data}))}};
}

describe('useBookmarksDnd — overflow open guard', () => {
    beforeEach(() => {
        registeredMonitors.length = 0;
    });

    test('onDropTargetChange forces overflow open when overflow exists', () => {
        const onReorder = jest.fn().mockResolvedValue(undefined);

        const {result} = renderHookWithContext(() => useBookmarksDnd({
            order: ['a', 'b', 'c', 'd'],
            visibleItems: ['a', 'b'],
            onReorder,
        }));

        expect(registeredMonitors).toHaveLength(1);
        const monitor = registeredMonitors[0];

        act(() => {
            monitor.onDropTargetChange({
                location: dropTargets({type: 'overflow-trigger'}),
            });
        });

        expect(result.current.forceOverflowOpen).toBe(true);
    });

    test('onDropTargetChange does NOT force overflow open when there is no overflow', () => {
        const onReorder = jest.fn().mockResolvedValue(undefined);

        const {result} = renderHookWithContext(() => useBookmarksDnd({
            order: ['a', 'b', 'c'],
            visibleItems: ['a', 'b', 'c'],
            onReorder,
        }));

        const monitor = registeredMonitors[0];

        act(() => {
            monitor.onDropTargetChange({
                location: dropTargets({type: 'overflow-trigger'}),
            });
        });

        expect(result.current.forceOverflowOpen).toBeUndefined();
    });

    test('onDrop does NOT force overflow open when dropping on overflow-trigger without overflow', () => {
        const onReorder = jest.fn().mockResolvedValue(undefined);

        const {result} = renderHookWithContext(() => useBookmarksDnd({
            order: ['a', 'b', 'c'],
            visibleItems: ['a', 'b', 'c'],
            onReorder,
        }));

        const monitor = registeredMonitors[0];

        act(() => {
            monitor.onDragStart({source: {data: {bookmarkId: 'a', type: 'bookmark'}}});
        });
        act(() => {
            monitor.onDrop({
                source: {data: {bookmarkId: 'a', type: 'bookmark'}},
                location: dropTargets({type: 'overflow-trigger'}),
            });
        });

        expect(result.current.forceOverflowOpen).toBe(false);
    });

    test('onDrop does NOT call onReorder when dropping on overflow-trigger without overflow', () => {
        const onReorder = jest.fn().mockResolvedValue(undefined);

        renderHookWithContext(() => useBookmarksDnd({
            order: ['a', 'b', 'c'],
            visibleItems: ['a', 'b', 'c'],
            onReorder,
        }));

        const monitor = registeredMonitors[0];

        act(() => {
            monitor.onDragStart({source: {data: {bookmarkId: 'a', type: 'bookmark'}}});
        });
        act(() => {
            monitor.onDrop({
                source: {data: {bookmarkId: 'a', type: 'bookmark'}},
                location: dropTargets({type: 'overflow-trigger'}),
            });
        });

        expect(onReorder).not.toHaveBeenCalled();
    });
});
