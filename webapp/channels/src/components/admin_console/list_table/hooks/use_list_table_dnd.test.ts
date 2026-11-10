// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useListTableDnd} from './use_list_table_dnd';

type MonitorConfig = {
    canMonitor: (args: {source: {data: Record<string, unknown>}}) => boolean;
    onDrop: (args: {
        source: {data: Record<string, unknown>};
        location: {current: {dropTargets: Array<{data: Record<string, unknown>}>}};
    }) => void;
};

// Capture PDND registrations so tests can invoke the callbacks directly.
// PDND only fires these from real HTML5 drag events, which jsdom doesn't
// dispatch — invoking them by hand is the practical way to exercise the
// hook's reorder math.
//
// Names are intentionally `mock`-prefixed: babel-plugin-jest-hoist hoists
// `jest.mock(...)` calls to the top of the module and only allows the
// factory to reference identifiers whose name matches `/^mock/i`.
const mockRegisteredMonitors: MonitorConfig[] = [];
const mockCleanupSpies: jest.Mock[] = [];

let mockNextExtractedEdge: 'top' | 'bottom' | null = 'bottom';

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
    monitorForElements: (config: MonitorConfig) => {
        mockRegisteredMonitors.push(config);
        const cleanup = jest.fn(() => {
            const idx = mockRegisteredMonitors.indexOf(config);
            if (idx !== -1) {
                mockRegisteredMonitors.splice(idx, 1);
            }
        });
        mockCleanupSpies.push(cleanup);
        return cleanup;
    },
}));

jest.mock('@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge', () => ({
    extractClosestEdge: () => mockNextExtractedEdge,
}));

function dropTargets(...targets: Array<Record<string, unknown>>) {
    return {current: {dropTargets: targets.map((data) => ({data}))}};
}

describe('useListTableDnd', () => {
    beforeEach(() => {
        mockRegisteredMonitors.length = 0;
        mockCleanupSpies.length = 0;
        mockNextExtractedEdge = 'bottom';
    });

    test('does not register a monitor when onReorder is not provided', () => {
        renderHookWithContext(() =>
            useListTableDnd({dragKind: 'kind-a', onReorder: undefined}));

        expect(mockRegisteredMonitors).toHaveLength(0);
        expect(mockCleanupSpies).toHaveLength(0);
    });

    test('registers exactly one monitor when onReorder is provided', () => {
        renderHookWithContext(() =>
            useListTableDnd({dragKind: 'kind-a', onReorder: jest.fn()}));

        expect(mockRegisteredMonitors).toHaveLength(1);
    });

    test('unmount runs the monitor cleanup', () => {
        const {unmount} = renderHookWithContext(() =>
            useListTableDnd({dragKind: 'kind-a', onReorder: jest.fn()}));

        expect(mockCleanupSpies).toHaveLength(1);
        expect(mockCleanupSpies[0]).not.toHaveBeenCalled();

        unmount();

        expect(mockCleanupSpies[0]).toHaveBeenCalledTimes(1);
        expect(mockRegisteredMonitors).toHaveLength(0);
    });

    test('canMonitor accepts only sources whose kind matches dragKind', () => {
        renderHookWithContext(() =>
            useListTableDnd({dragKind: 'kind-a', onReorder: jest.fn()}));

        const {canMonitor} = mockRegisteredMonitors[0];
        expect(canMonitor({source: {data: {kind: 'kind-a'}}})).toBe(true);
        expect(canMonitor({source: {data: {kind: 'kind-b'}}})).toBe(false);
        expect(canMonitor({source: {data: {}}})).toBe(false);
    });

    test('onDrop is a no-op when the location has no drop targets', () => {
        const onReorder = jest.fn();
        renderHookWithContext(() =>
            useListTableDnd({dragKind: 'kind-a', onReorder}));

        act(() => {
            mockRegisteredMonitors[0].onDrop({
                source: {data: {kind: 'kind-a', rowIndex: 2}},
                location: {current: {dropTargets: []}},
            });
        });

        expect(onReorder).not.toHaveBeenCalled();
    });

    // The four-case truth table for getDropIndex is the core "reorder math"
    // for the whole table primitive. Drive it through the captured onDrop
    // since the helper itself is module-private.
    describe('getDropIndex resolution (top/bottom × source position)', () => {
        test('drop on TOP edge of a target BELOW the source → target - 1', () => {
            mockNextExtractedEdge = 'top';
            const onReorder = jest.fn();
            renderHookWithContext(() =>
                useListTableDnd({dragKind: 'kind-a', onReorder}));

            act(() => {
                mockRegisteredMonitors[0].onDrop({
                    source: {data: {kind: 'kind-a', rowIndex: 1}},
                    location: dropTargets({kind: 'kind-a', rowIndex: 4}),
                });
            });

            expect(onReorder).toHaveBeenCalledWith(1, 3);
        });

        test('drop on TOP edge of a target ABOVE the source → target', () => {
            mockNextExtractedEdge = 'top';
            const onReorder = jest.fn();
            renderHookWithContext(() =>
                useListTableDnd({dragKind: 'kind-a', onReorder}));

            act(() => {
                mockRegisteredMonitors[0].onDrop({
                    source: {data: {kind: 'kind-a', rowIndex: 5}},
                    location: dropTargets({kind: 'kind-a', rowIndex: 2}),
                });
            });

            expect(onReorder).toHaveBeenCalledWith(5, 2);
        });

        test('drop on BOTTOM edge of a target BELOW the source → target', () => {
            mockNextExtractedEdge = 'bottom';
            const onReorder = jest.fn();
            renderHookWithContext(() =>
                useListTableDnd({dragKind: 'kind-a', onReorder}));

            act(() => {
                mockRegisteredMonitors[0].onDrop({
                    source: {data: {kind: 'kind-a', rowIndex: 1}},
                    location: dropTargets({kind: 'kind-a', rowIndex: 4}),
                });
            });

            expect(onReorder).toHaveBeenCalledWith(1, 4);
        });

        test('drop on BOTTOM edge of a target ABOVE the source → target + 1', () => {
            mockNextExtractedEdge = 'bottom';
            const onReorder = jest.fn();
            renderHookWithContext(() =>
                useListTableDnd({dragKind: 'kind-a', onReorder}));

            act(() => {
                mockRegisteredMonitors[0].onDrop({
                    source: {data: {kind: 'kind-a', rowIndex: 5}},
                    location: dropTargets({kind: 'kind-a', rowIndex: 2}),
                });
            });

            expect(onReorder).toHaveBeenCalledWith(5, 3);
        });

        test('does not call onReorder when computed dropIndex equals sourceIndex', () => {
            // Drop on TOP edge of the row directly after source (3 → top of 4)
            // resolves to 3, which is a no-op.
            mockNextExtractedEdge = 'top';
            const onReorder = jest.fn();
            renderHookWithContext(() =>
                useListTableDnd({dragKind: 'kind-a', onReorder}));

            act(() => {
                mockRegisteredMonitors[0].onDrop({
                    source: {data: {kind: 'kind-a', rowIndex: 3}},
                    location: dropTargets({kind: 'kind-a', rowIndex: 4}),
                });
            });

            expect(onReorder).not.toHaveBeenCalled();
        });
    });

    test('uses the latest onReorder via ref without re-registering the monitor', () => {
        // Mirrors the typical consumer pattern: a fresh closure is built
        // every render. The hook intentionally omits onReorder from its
        // dependency array (it reads through useLatest) so the PDND
        // registration is not torn down on every parent render.
        let currentOnReorder: jest.Mock = jest.fn();

        const {rerender} = renderHookWithContext(() =>
            useListTableDnd({dragKind: 'kind-a', onReorder: currentOnReorder}));

        expect(mockRegisteredMonitors).toHaveLength(1);
        const firstMonitor = mockRegisteredMonitors[0];

        const replacement = jest.fn();
        currentOnReorder = replacement;
        rerender();

        expect(mockRegisteredMonitors).toHaveLength(1);
        expect(mockRegisteredMonitors[0]).toBe(firstMonitor);
        expect(mockCleanupSpies[0]).not.toHaveBeenCalled();

        act(() => {
            firstMonitor.onDrop({
                source: {data: {kind: 'kind-a', rowIndex: 1}},
                location: dropTargets({kind: 'kind-a', rowIndex: 4}),
            });
        });

        expect(replacement).toHaveBeenCalledWith(1, 4);
    });

    test('changing dragKind tears down the old monitor and registers a new one', () => {
        // The hook keeps `dragKind` in the dep array because the monitor's
        // `canMonitor` predicate is captured by identity; a real change
        // must re-register.
        let currentKind = 'kind-a';

        const {rerender} = renderHookWithContext(() =>
            useListTableDnd({dragKind: currentKind, onReorder: jest.fn()}));

        expect(mockRegisteredMonitors).toHaveLength(1);

        currentKind = 'kind-b';
        rerender();

        expect(mockCleanupSpies[0]).toHaveBeenCalledTimes(1);
        expect(mockRegisteredMonitors).toHaveLength(1);

        // The fresh monitor accepts only the new kind.
        expect(mockRegisteredMonitors[0].canMonitor({source: {data: {kind: 'kind-a'}}})).toBe(false);
        expect(mockRegisteredMonitors[0].canMonitor({source: {data: {kind: 'kind-b'}}})).toBe(true);
    });
});
