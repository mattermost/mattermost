// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';

import {useBurnOnReadTimer} from './useBurnOnReadTimer';

describe('useBurnOnReadTimer', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should initialize with correct remaining time', () => {
        const expireAt = new Date('2025-01-01T00:10:00.000Z').getTime();
        const {result} = renderHook(() => useBurnOnReadTimer({expireAt}));

        expect(result.current.remainingMs).toBe(600000); // 10 minutes
        expect(result.current.displayText).toBe('10:00');
        expect(result.current.isExpired).toBe(false);
        expect(result.current.isWarning).toBe(false);
    });

    it('should update timer every second', () => {
        const expireAt = new Date('2025-01-01T00:00:05.000Z').getTime();
        const {result} = renderHook(() => useBurnOnReadTimer({expireAt}));

        expect(result.current.displayText).toBe('00:05');

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(result.current.displayText).toBe('00:04');

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(result.current.displayText).toBe('00:03');
    });

    it('should enter warning state when <= 1 minute remaining', () => {
        const expireAt = new Date('2025-01-01T00:01:00.000Z').getTime();
        const {result} = renderHook(() => useBurnOnReadTimer({expireAt}));

        expect(result.current.isWarning).toBe(true);
        expect(result.current.displayText).toBe('01:00');
    });

    it('should update display when timer reaches zero', () => {
        const expireAt = new Date('2025-01-01T00:00:03.000Z').getTime();
        const {result} = renderHook(() => useBurnOnReadTimer({expireAt}));

        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(result.current.isExpired).toBe(true);
        expect(result.current.displayText).toBe('00:00');
    });

    it('should stop updating after expiration', () => {
        const expireAt = new Date('2025-01-01T00:00:02.000Z').getTime();
        const {result} = renderHook(() => useBurnOnReadTimer({expireAt}));

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        expect(result.current.isExpired).toBe(true);

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        // Should still be expired, not update further
        expect(result.current.isExpired).toBe(true);
    });

    it('should handle null expireAt', () => {
        const {result} = renderHook(() => useBurnOnReadTimer({expireAt: null}));

        expect(result.current.remainingMs).toBe(0);
        expect(result.current.displayText).toBe('00:00');
        expect(result.current.isExpired).toBe(true);
    });

    it('should handle already expired timer', () => {
        const expireAt = new Date('2024-12-31T23:00:00.000Z').getTime();
        const {result} = renderHook(() => useBurnOnReadTimer({expireAt}));

        expect(result.current.isExpired).toBe(true);
        expect(result.current.displayText).toBe('00:00');
    });

    it('should update when expireAt prop changes', () => {
        const {result, rerender} = renderHook(
            ({expireAt}) => useBurnOnReadTimer({expireAt}),
            {initialProps: {expireAt: new Date('2025-01-01T00:05:00.000Z').getTime()}},
        );

        expect(result.current.displayText).toBe('05:00');

        rerender({expireAt: new Date('2025-01-01T00:10:00.000Z').getTime()});

        expect(result.current.displayText).toBe('10:00');
    });

    it('should cleanup interval on unmount', () => {
        const expireAt = new Date('2025-01-01T00:10:00.000Z').getTime();
        const {unmount} = renderHook(() => useBurnOnReadTimer({expireAt}));

        const intervalCount = jest.getTimerCount();
        unmount();

        expect(jest.getTimerCount()).toBeLessThan(intervalCount);
    });

    it('should mark as expired when remainingMs reaches 0', () => {
        const expireAt = new Date('2025-01-01T00:00:02.000Z').getTime();
        const {result} = renderHook(() => useBurnOnReadTimer({expireAt}));

        expect(result.current.isExpired).toBe(false);

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        expect(result.current.isExpired).toBe(true);
        expect(result.current.displayText).toBe('00:00');
    });
});
