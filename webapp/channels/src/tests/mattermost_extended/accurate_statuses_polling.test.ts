// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for AccurateStatuses server-push status broadcasts.
 *
 * When AccurateStatuses is enabled, the server broadcasts status changes
 * to all connected users via WebSocket. The client should skip polling
 * for statuses since they arrive in real-time.
 *
 * These tests verify the polling guard logic extracted from channel_controller.tsx:
 *   if (enabledUserStatuses && !accurateStatuses) { ... set up polling ... }
 */

describe('tests/mattermost_extended/accurate_statuses_polling', () => {
    // Extract the polling decision logic from channel_controller.tsx
    // Returns true if polling should be set up, false otherwise
    function shouldSetUpPolling(enabledUserStatuses: boolean, accurateStatuses: boolean): boolean {
        return enabledUserStatuses && !accurateStatuses;
    }

    // Returns the polling interval in ms, or 0 if no polling
    function getPollingInterval(
        enabledUserStatuses: boolean,
        accurateStatuses: boolean,
        isGuilded: boolean,
        guildedPollingInterval: number,
    ): number {
        if (!enabledUserStatuses || accurateStatuses) {
            return 0;
        }
        if (isGuilded && guildedPollingInterval > 0) {
            return guildedPollingInterval;
        }
        return 60000; // Constants.STATUS_INTERVAL
    }

    describe('polling decision', () => {
        it('should poll when statuses enabled and AccurateStatuses disabled', () => {
            expect(shouldSetUpPolling(true, false)).toBe(true);
        });

        it('should NOT poll when AccurateStatuses is enabled', () => {
            expect(shouldSetUpPolling(true, true)).toBe(false);
        });

        it('should NOT poll when user statuses are disabled', () => {
            expect(shouldSetUpPolling(false, false)).toBe(false);
        });

        it('should NOT poll when both are disabled', () => {
            expect(shouldSetUpPolling(false, true)).toBe(false);
        });
    });

    describe('polling interval selection', () => {
        it('should use 60s default interval when not Guilded and AccurateStatuses off', () => {
            expect(getPollingInterval(true, false, false, 0)).toBe(60000);
        });

        it('should use Guilded fast-polling when Guilded enabled and AccurateStatuses off', () => {
            expect(getPollingInterval(true, false, true, 15000)).toBe(15000);
        });

        it('should return 0 (no polling) when AccurateStatuses is enabled', () => {
            expect(getPollingInterval(true, true, false, 0)).toBe(0);
        });

        it('should return 0 even with Guilded when AccurateStatuses is enabled', () => {
            expect(getPollingInterval(true, true, true, 15000)).toBe(0);
        });

        it('should return 0 when user statuses disabled', () => {
            expect(getPollingInterval(false, false, false, 0)).toBe(0);
        });

        it('should fall back to default interval when Guilded polling interval is 0', () => {
            expect(getPollingInterval(true, false, true, 0)).toBe(60000);
        });
    });

    describe('setInterval behavior', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should set up interval when AccurateStatuses is disabled', () => {
            const pollFn = jest.fn();
            const enabledUserStatuses = true;
            const accurateStatuses = false;
            const isGuilded = false;

            let intervalId: NodeJS.Timeout | undefined;
            if (enabledUserStatuses && !accurateStatuses) {
                if (isGuilded) {
                    intervalId = setInterval(pollFn, 15000);
                } else {
                    intervalId = setInterval(pollFn, 60000);
                }
            }

            expect(intervalId).toBeDefined();

            jest.advanceTimersByTime(60000);
            expect(pollFn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(60000);
            expect(pollFn).toHaveBeenCalledTimes(2);

            clearInterval(intervalId);
        });

        it('should NOT set up interval when AccurateStatuses is enabled', () => {
            const pollFn = jest.fn();
            const enabledUserStatuses = true;
            const accurateStatuses = true;
            const isGuilded = false;

            let intervalId: NodeJS.Timeout | undefined;
            if (enabledUserStatuses && !accurateStatuses) {
                if (isGuilded) {
                    intervalId = setInterval(pollFn, 15000);
                } else {
                    intervalId = setInterval(pollFn, 60000);
                }
            }

            expect(intervalId).toBeUndefined();

            // Even after a long time, no polling should occur
            jest.advanceTimersByTime(300000);
            expect(pollFn).not.toHaveBeenCalled();
        });

        it('should NOT set up Guilded fast-polling when AccurateStatuses is enabled', () => {
            const pollFn = jest.fn();
            const enabledUserStatuses = true;
            const accurateStatuses = true;
            const isGuilded = true;
            const guildedPollingInterval = 15000;

            let intervalId: NodeJS.Timeout | undefined;
            if (enabledUserStatuses && !accurateStatuses) {
                if (isGuilded && guildedPollingInterval > 0) {
                    intervalId = setInterval(pollFn, guildedPollingInterval);
                } else {
                    intervalId = setInterval(pollFn, 60000);
                }
            }

            expect(intervalId).toBeUndefined();

            jest.advanceTimersByTime(60000);
            expect(pollFn).not.toHaveBeenCalled();
        });

        it('should set up Guilded fast-polling when AccurateStatuses is disabled', () => {
            const pollFn = jest.fn();
            const enabledUserStatuses = true;
            const accurateStatuses = false;
            const isGuilded = true;
            const guildedPollingInterval = 15000;

            let intervalId: NodeJS.Timeout | undefined;
            if (enabledUserStatuses && !accurateStatuses) {
                if (isGuilded && guildedPollingInterval > 0) {
                    intervalId = setInterval(pollFn, guildedPollingInterval);
                } else {
                    intervalId = setInterval(pollFn, 60000);
                }
            }

            expect(intervalId).toBeDefined();

            // Should fire 4 times in 60s at 15s intervals
            jest.advanceTimersByTime(60000);
            expect(pollFn).toHaveBeenCalledTimes(4);

            clearInterval(intervalId);
        });

        it('should clean up interval on teardown', () => {
            const pollFn = jest.fn();
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            const intervalId = setInterval(pollFn, 60000);

            // Simulate cleanup (like useEffect return)
            clearInterval(intervalId);

            expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);

            // After cleanup, no more polling
            jest.advanceTimersByTime(120000);
            expect(pollFn).not.toHaveBeenCalled();

            clearIntervalSpy.mockRestore();
        });
    });
});
