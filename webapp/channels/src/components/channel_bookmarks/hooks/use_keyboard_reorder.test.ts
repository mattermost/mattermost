// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import type React from 'react';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useKeyboardReorder} from './use_keyboard_reorder';

function fakeKeyEvent(key: string): React.KeyboardEvent {
    return {
        key,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        get defaultPrevented() {
            return false;
        },
    } as unknown as React.KeyboardEvent;
}

interface SetupOpts {
    order?: string[];
    visibleItems?: string[];
    overflowItems?: string[];
    canReorder?: boolean;
}

function setup({
    order = ['a', 'b', 'c', 'd', 'e'],
    visibleItems = ['a', 'b', 'c'],
    overflowItems = ['d', 'e'],
    canReorder = true,
}: SetupOpts = {}) {
    const onReorder = jest.fn().mockResolvedValue(undefined);
    const onOverflowOpenChange = jest.fn();
    const getName = jest.fn((id: string) => `name-${id}`);

    const {result} = renderHookWithContext(
        () => useKeyboardReorder({
            order,
            visibleItems,
            overflowItems,
            onReorder,
            getName,
            onOverflowOpenChange,
            canReorder,
        }),
    );

    return {result, onReorder, onOverflowOpenChange};
}

describe('useKeyboardReorder — overflow menu signaling', () => {
    describe('startReorder', () => {
        test('issues onOverflowOpenChange(true) when starting on an overflow item', () => {
            const {result, onOverflowOpenChange} = setup();

            act(() => {
                result.current.getItemProps('d').onKeyDown(fakeKeyEvent(' '));
            });

            expect(onOverflowOpenChange).toHaveBeenCalledTimes(1);
            expect(onOverflowOpenChange).toHaveBeenCalledWith(true);
        });

        test('does NOT issue onOverflowOpenChange when starting on a bar item', () => {
            const {result, onOverflowOpenChange} = setup();

            act(() => {
                result.current.getItemProps('a').onKeyDown(fakeKeyEvent(' '));
            });

            expect(onOverflowOpenChange).not.toHaveBeenCalled();
        });
    });

    describe('moveItem cross-container', () => {
        test('ArrowRight at last visible bar item → onOverflowOpenChange(true)', () => {
            const {result, onOverflowOpenChange} = setup();

            // Start reorder on the last visible bar item (c at index 2 of 3 visible)
            act(() => {
                result.current.getItemProps('c').onKeyDown(fakeKeyEvent(' '));
            });
            onOverflowOpenChange.mockClear();

            // ArrowRight crosses bar→overflow
            act(() => {
                result.current.getItemProps('c').onKeyDown(fakeKeyEvent('ArrowRight'));
            });

            expect(onOverflowOpenChange).toHaveBeenCalledWith(true);
        });

        test('ArrowUp at first overflow item → onOverflowOpenChange(false)', () => {
            const {result, onOverflowOpenChange} = setup();

            // Start reorder on the first overflow item (d at index 3, firstOverflowGlobalIndex)
            act(() => {
                result.current.getItemProps('d').onKeyDown(fakeKeyEvent(' '));
            });
            onOverflowOpenChange.mockClear();

            // ArrowUp crosses overflow→bar
            act(() => {
                result.current.getItemProps('d').onKeyDown(fakeKeyEvent('ArrowUp'));
            });

            expect(onOverflowOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('confirmReorder', () => {
        test('item in overflow at confirm → onOverflowOpenChange(true)', () => {
            const {result, onOverflowOpenChange} = setup();

            // Start reorder on overflow item; confirm without moving
            act(() => {
                result.current.getItemProps('d').onKeyDown(fakeKeyEvent(' '));
            });
            onOverflowOpenChange.mockClear();

            act(() => {
                result.current.getItemProps('d').onKeyDown(fakeKeyEvent(' '));
            });

            expect(onOverflowOpenChange).toHaveBeenCalledWith(true);
        });

        test('item in bar at confirm → onOverflowOpenChange(false)', () => {
            const {result, onOverflowOpenChange} = setup();

            // Start reorder on bar item; confirm without moving
            act(() => {
                result.current.getItemProps('a').onKeyDown(fakeKeyEvent(' '));
            });

            // Bar item start does not signal; the confirm call should be the
            // only invocation, with `false` since 'a' is not in overflow.
            act(() => {
                result.current.getItemProps('a').onKeyDown(fakeKeyEvent(' '));
            });

            expect(onOverflowOpenChange).toHaveBeenCalledTimes(1);
            expect(onOverflowOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('cancelReorder', () => {
        test('Escape during reorder → onOverflowOpenChange(false)', async () => {
            const {result, onOverflowOpenChange} = setup();

            act(() => {
                result.current.getItemProps('d').onKeyDown(fakeKeyEvent(' '));
            });
            onOverflowOpenChange.mockClear();

            await act(async () => {
                result.current.getItemProps('d').onKeyDown(fakeKeyEvent('Escape'));
            });

            expect(onOverflowOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('canReorder=false', () => {
        test('Space does not start reorder', () => {
            const {result, onOverflowOpenChange} = setup({canReorder: false});

            act(() => {
                result.current.getItemProps('d').onKeyDown(fakeKeyEvent(' '));
            });

            expect(onOverflowOpenChange).not.toHaveBeenCalled();
            expect(result.current.reorderState.isReordering).toBe(false);
        });
    });
});
