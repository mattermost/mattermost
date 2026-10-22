// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';

import {useDebounce} from './useDebounce';

describe('useDebounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should not invoke the callback immediately when called', () => {
        const callback = jest.fn();
        const {result} = renderHook(() => useDebounce(callback, 300));

        act(() => {
            result.current();
        });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should invoke the callback once after the delay elapses', () => {
        const callback = jest.fn();
        const {result} = renderHook(() => useDebounce(callback, 300));

        act(() => {
            result.current();
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should coalesce rapid calls — only the last invocation fires the callback', () => {
        const callback = jest.fn();
        const {result} = renderHook(() => useDebounce(callback, 300));

        act(() => {
            result.current('a');
            result.current('b');
            result.current('c');
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('c');
    });

    it('should pass arguments through to the callback', () => {
        const callback = jest.fn();
        const {result} = renderHook(() => useDebounce(callback, 200));

        act(() => {
            result.current('hello', 42);
        });

        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(callback).toHaveBeenCalledWith('hello', 42);
    });

    it('should not fire the callback when cancel() is called before the delay elapses', () => {
        const callback = jest.fn();
        const {result} = renderHook(() => useDebounce(callback, 300));

        act(() => {
            result.current();
        });

        act(() => {
            result.current.cancel();
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should not invoke the callback after the component unmounts', () => {
        const callback = jest.fn();
        const {result, unmount} = renderHook(() => useDebounce(callback, 300));

        act(() => {
            result.current();
        });

        unmount();

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should always invoke the most recent callback identity — no stale-closure bug', () => {
        const firstCallback = jest.fn();
        const secondCallback = jest.fn();

        const {result, rerender} = renderHook(
            ({cb}) => useDebounce(cb, 300),
            {initialProps: {cb: firstCallback}},
        );

        // Schedule with firstCallback
        act(() => {
            result.current();
        });

        // Swap to secondCallback before the delay fires
        rerender({cb: secondCallback});

        act(() => {
            jest.advanceTimersByTime(300);
        });

        // The debounced function was scheduled before the rerender, but useLatest
        // ensures the most recent callback is invoked when the timer fires.
        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).toHaveBeenCalledTimes(1);
    });

    it('should allow a new call after a prior one has been cancelled', () => {
        const callback = jest.fn();
        const {result} = renderHook(() => useDebounce(callback, 300));

        act(() => {
            result.current('first');
        });

        act(() => {
            result.current.cancel();
        });

        act(() => {
            result.current('second');
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('second');
    });
});
