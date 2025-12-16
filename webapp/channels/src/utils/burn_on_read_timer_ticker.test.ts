// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {timerTicker} from './burn_on_read_timer_ticker';

describe('BurnOnReadTimerTicker', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        timerTicker.cleanup();
    });

    afterEach(() => {
        jest.useRealTimers();
        timerTicker.cleanup();
    });

    it('should start ticker on first subscription', () => {
        const callback = jest.fn();

        timerTicker.subscribe(callback);

        expect(timerTicker.getSubscriberCount()).toBe(1);

        jest.advanceTimersByTime(1000);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(expect.any(Number)); // Should receive timestamp
    });

    it('should stop ticker when last subscriber unsubscribes', () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();

        const unsubscribe1 = timerTicker.subscribe(callback1);
        const unsubscribe2 = timerTicker.subscribe(callback2);

        jest.advanceTimersByTime(1000);

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();

        jest.advanceTimersByTime(1000);

        expect(callback1).toHaveBeenCalledTimes(1); // No more calls
        expect(callback2).toHaveBeenCalledTimes(2); // Still receiving

        unsubscribe2();

        jest.advanceTimersByTime(1000);

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(2); // No more calls
    });

    it('should broadcast to all subscribers simultaneously', () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        const callback3 = jest.fn();

        timerTicker.subscribe(callback1);
        timerTicker.subscribe(callback2);
        timerTicker.subscribe(callback3);

        jest.advanceTimersByTime(3000);

        expect(callback1).toHaveBeenCalledTimes(3);
        expect(callback2).toHaveBeenCalledTimes(3);
        expect(callback3).toHaveBeenCalledTimes(3);

        // All callbacks should receive the same timestamp per tick
        const firstTickTime = callback1.mock.calls[0][0];
        expect(callback2.mock.calls[0][0]).toBe(firstTickTime);
        expect(callback3.mock.calls[0][0]).toBe(firstTickTime);
    });

    it('should handle subscriber errors gracefully', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const errorCallback = jest.fn((now: number) => {
            expect(typeof now).toBe('number');
            throw new Error('Test error');
        });
        const successCallback = jest.fn();

        timerTicker.subscribe(errorCallback);
        timerTicker.subscribe(successCallback);

        jest.advanceTimersByTime(1000);

        expect(errorCallback).toHaveBeenCalledTimes(1);
        expect(successCallback).toHaveBeenCalledTimes(1); // Should still be called despite error

        consoleErrorSpy.mockRestore();
    });

    it('should not start multiple intervals', () => {
        const callback = jest.fn();

        timerTicker.subscribe(callback);
        timerTicker.subscribe(callback); // Try to subscribe same callback twice

        jest.advanceTimersByTime(1000);

        // Should only be called once per tick (Set prevents duplicates)
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function from subscribe', () => {
        const callback = jest.fn();

        const unsubscribe = timerTicker.subscribe(callback);

        jest.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalledTimes(1);

        unsubscribe();

        jest.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalledTimes(1); // No more calls
    });

    it('should handle rapid subscribe/unsubscribe', () => {
        const callback = jest.fn();

        const unsubscribe1 = timerTicker.subscribe(callback);
        unsubscribe1();

        const unsubscribe2 = timerTicker.subscribe(callback);

        jest.advanceTimersByTime(1000);

        expect(callback).toHaveBeenCalledTimes(1);

        unsubscribe2();
    });

    it('should track subscriber count correctly', () => {
        expect(timerTicker.getSubscriberCount()).toBe(0);

        const unsubscribe1 = timerTicker.subscribe(() => {});
        expect(timerTicker.getSubscriberCount()).toBe(1);

        const unsubscribe2 = timerTicker.subscribe(() => {});
        expect(timerTicker.getSubscriberCount()).toBe(2);

        const unsubscribe3 = timerTicker.subscribe(() => {});
        expect(timerTicker.getSubscriberCount()).toBe(3);

        unsubscribe2();
        expect(timerTicker.getSubscriberCount()).toBe(2);

        unsubscribe1();
        expect(timerTicker.getSubscriberCount()).toBe(1);

        unsubscribe3();
        expect(timerTicker.getSubscriberCount()).toBe(0);
    });
});
