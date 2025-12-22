// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expirationScheduler} from './burn_on_read_expiration_scheduler';

describe('BurnOnReadExpirationScheduler', () => {
    let mockDispatch: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
        mockDispatch = jest.fn();
        expirationScheduler.initialize(mockDispatch);
    });

    afterEach(() => {
        expirationScheduler.cleanup();
        jest.useRealTimers();
    });

    describe('registerPost', () => {
        it('should schedule expiration for a single post', () => {
            const expireAt = new Date('2025-01-01T00:10:00.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt, null);

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(1);
            expect(state.nextExpiration).toBe(expireAt);
        });

        it('should handle expired posts beyond grace period', () => {
            // Post expired 5 seconds ago (beyond 2 second grace period)
            const expireAt = Date.now() - 5000;

            expirationScheduler.registerPost('post1', expireAt, null);

            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith(expect.any(Function));

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(0);
        });

        it('should NOT immediately expire posts within grace period', () => {
            // Post expired 1 second ago (within 2 second grace period)
            const expireAt = Date.now() - 1000;

            expirationScheduler.registerPost('post1', expireAt, null);

            // Should schedule for future expiration, not immediate
            expect(mockDispatch).not.toHaveBeenCalled();

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(1);
        });

        it('should choose the earlier expiration when both timers are set', () => {
            const expireAt = new Date('2025-01-01T00:10:00.000Z').getTime();
            const maxExpireAt = new Date('2025-01-01T00:05:00.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt, maxExpireAt);

            const state = expirationScheduler.getState();
            expect(state.nextExpiration).toBe(maxExpireAt); // Earlier one
        });

        it('should handle max_expire_at only', () => {
            const maxExpireAt = new Date('2025-01-01T00:10:00.000Z').getTime();

            expirationScheduler.registerPost('post1', null, maxExpireAt);

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(1);
            expect(state.nextExpiration).toBe(maxExpireAt);
        });

        it('should handle expire_at only', () => {
            const expireAt = new Date('2025-01-01T00:10:00.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt, null);

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(1);
            expect(state.nextExpiration).toBe(expireAt);
        });

        it('should unregister post when neither timer is set', () => {
            const expireAt = new Date('2025-01-01T00:10:00.000Z').getTime();
            expirationScheduler.registerPost('post1', expireAt, null);

            // Now remove both timers
            expirationScheduler.registerPost('post1', null, null);

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(0);
        });
    });

    describe('unregisterPost', () => {
        it('should remove post from tracking', () => {
            const expireAt = new Date('2025-01-01T00:10:00.000Z').getTime();
            expirationScheduler.registerPost('post1', expireAt, null);

            expirationScheduler.unregisterPost('post1');

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(0);
        });

        it('should reschedule when removing the next-expiring post', () => {
            const expireAt1 = new Date('2025-01-01T00:05:00.000Z').getTime();
            const expireAt2 = new Date('2025-01-01T00:10:00.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt1, null);
            expirationScheduler.registerPost('post2', expireAt2, null);

            expect(expirationScheduler.getState().nextExpiration).toBe(expireAt1);

            // Remove the next-expiring post
            expirationScheduler.unregisterPost('post1');

            // Should now schedule post2
            expect(expirationScheduler.getState().nextExpiration).toBe(expireAt2);
        });
    });

    describe('expiration handling', () => {
        it('should dispatch expiration action when timer fires (after grace period)', () => {
            const expireAt = new Date('2025-01-01T00:00:05.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt, null);

            // Fast-forward to expiration time
            jest.advanceTimersByTime(5000);

            // Should NOT dispatch yet - grace period not passed
            expect(mockDispatch).not.toHaveBeenCalled();

            // Fast-forward past grace period (2 seconds)
            jest.advanceTimersByTime(2000);

            // Now should dispatch
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should handle multiple posts expiring in sequence', () => {
            const expireAt1 = new Date('2025-01-01T00:00:05.000Z').getTime();
            const expireAt2 = new Date('2025-01-01T00:00:10.000Z').getTime();
            const expireAt3 = new Date('2025-01-01T00:00:15.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt1, null);
            expirationScheduler.registerPost('post2', expireAt2, null);
            expirationScheduler.registerPost('post3', expireAt3, null);

            // First expiration (5s + 2s grace = 7s)
            jest.advanceTimersByTime(7000);
            expect(mockDispatch).toHaveBeenCalledTimes(1);

            // Second expiration (5s more from 7s = 12s, needs 10s + 2s grace = 12s)
            jest.advanceTimersByTime(5000);
            expect(mockDispatch).toHaveBeenCalledTimes(2);

            // Third expiration (5s more from 12s = 17s, needs 15s + 2s grace = 17s)
            jest.advanceTimersByTime(5000);
            expect(mockDispatch).toHaveBeenCalledTimes(3);

            expect(expirationScheduler.getState().activeTimers).toBe(0);
        });

        it('should handle posts registered out of order', () => {
            // Register in reverse order
            const expireAt1 = new Date('2025-01-01T00:00:15.000Z').getTime();
            const expireAt2 = new Date('2025-01-01T00:00:05.000Z').getTime();
            const expireAt3 = new Date('2025-01-01T00:00:10.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt1, null);
            expirationScheduler.registerPost('post2', expireAt2, null);
            expirationScheduler.registerPost('post3', expireAt3, null);

            // Should still expire in correct order: post2, post3, post1
            // post2: 5s + 2s grace = 7s
            jest.advanceTimersByTime(7000);
            expect(mockDispatch).toHaveBeenCalledTimes(1);

            // post3: 10s + 2s grace = 12s (5s more from 7s)
            jest.advanceTimersByTime(5000);
            expect(mockDispatch).toHaveBeenCalledTimes(2);

            // post1: 15s + 2s grace = 17s (5s more from 12s)
            jest.advanceTimersByTime(5000);
            expect(mockDispatch).toHaveBeenCalledTimes(3);
        });

        it('should handle updating expiration time for existing post', () => {
            const expireAt1 = new Date('2025-01-01T00:00:10.000Z').getTime();
            const expireAt2 = new Date('2025-01-01T00:00:05.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt1, null);
            expect(expirationScheduler.getState().nextExpiration).toBe(expireAt1);

            // Update to earlier time
            expirationScheduler.registerPost('post1', expireAt2, null);
            expect(expirationScheduler.getState().nextExpiration).toBe(expireAt2);

            // 5s + 2s grace = 7s
            jest.advanceTimersByTime(7000);
            expect(mockDispatch).toHaveBeenCalledTimes(1);
        });
    });

    describe('cleanup', () => {
        it('should clear all timers and state', () => {
            const expireAt1 = new Date('2025-01-01T00:10:00.000Z').getTime();
            const expireAt2 = new Date('2025-01-01T00:20:00.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt1, null);
            expirationScheduler.registerPost('post2', expireAt2, null);

            expirationScheduler.cleanup();

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(0);
            expect(state.nextExpiration).toBeNull();
        });

        it('should not dispatch after cleanup', () => {
            const expireAt = new Date('2025-01-01T00:00:05.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt, null);
            expirationScheduler.cleanup();

            jest.advanceTimersByTime(5000);

            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });

    describe('checkAndExpirePosts', () => {
        it('should immediately check and expire posts past grace period', () => {
            const expireAt = Date.now() + 5000; // 5 seconds in future

            expirationScheduler.registerPost('post1', expireAt, null);

            // Should schedule for future, not immediate
            expect(mockDispatch).not.toHaveBeenCalled();

            // Advance time past expiration + grace (2s)
            jest.setSystemTime(expireAt + 3000);

            // Manual check should expire it immediately
            expirationScheduler.checkAndExpirePosts();

            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(expirationScheduler.getState().activeTimers).toBe(0);
        });

        it('should not expire posts still within grace period', () => {
            const expireAt = Date.now() - 1000; // 1 second ago (within 2s grace)

            expirationScheduler.registerPost('post1', expireAt, null);

            expirationScheduler.checkAndExpirePosts();

            expect(mockDispatch).not.toHaveBeenCalled();
            expect(expirationScheduler.getState().activeTimers).toBe(1);
        });
    });

    describe('edge cases', () => {
        it('should handle posts expiring right now (within grace period)', () => {
            const expireAt = Date.now();

            expirationScheduler.registerPost('post1', expireAt, null);

            // Should NOT expire immediately (within grace period)
            expect(mockDispatch).not.toHaveBeenCalled();

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(1);
        });

        it('should handle recently expired posts (within grace period)', () => {
            const expireAt = Date.now() - 1000; // 1 second ago

            expirationScheduler.registerPost('post1', expireAt, null);

            // Should NOT expire immediately (within 2s grace period)
            expect(mockDispatch).not.toHaveBeenCalled();

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(1);
        });

        it('should handle very large delays', () => {
            const expireAt = new Date('2026-01-01T00:00:00.000Z').getTime(); // 1 year

            expirationScheduler.registerPost('post1', expireAt, null);

            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(1);
            expect(state.nextExpiration).toBe(expireAt);
        });

        it('should handle registering the same post multiple times', () => {
            const expireAt1 = new Date('2025-01-01T00:10:00.000Z').getTime();
            const expireAt2 = new Date('2025-01-01T00:05:00.000Z').getTime();

            expirationScheduler.registerPost('post1', expireAt1, null);
            expirationScheduler.registerPost('post1', expireAt2, null);

            // Should only have 1 timer
            const state = expirationScheduler.getState();
            expect(state.activeTimers).toBe(1);
            expect(state.nextExpiration).toBe(expireAt2);
        });
    });
});
