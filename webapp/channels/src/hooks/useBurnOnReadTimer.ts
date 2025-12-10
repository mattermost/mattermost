// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState, useMemo} from 'react';

import {timerTicker} from 'utils/burn_on_read_timer_ticker';
import {
    calculateRemainingTime,
    formatTimeRemaining,
    isTimerExpired,
    isTimerInWarningState,
} from 'utils/burn_on_read_timer_utils';

interface TimerState {
    remainingMs: number;
    displayText: string;
    isExpired: boolean;
    isWarning: boolean;
}

interface UseBurnOnReadTimerOptions {
    expireAt: number | null;
}

/**
 * Hook to display burn-on-read countdown timer
 * Subscribes to global ticker for synchronized updates (O(1) intervals for all timers)
 * Expiration handling is managed by the global BurnOnReadExpirationScheduler
 */
export function useBurnOnReadTimer({expireAt}: UseBurnOnReadTimerOptions): TimerState {
    const [remainingMs, setRemainingMs] = useState<number>(() => {
        if (!expireAt) {
            return 0;
        }
        return calculateRemainingTime(expireAt);
    });

    // Subscribe to global ticker for synchronized updates
    useEffect(() => {
        if (!expireAt) {
            return undefined;
        }

        // Initial calculation
        const initialRemaining = calculateRemainingTime(expireAt);
        setRemainingMs(initialRemaining);

        // If already expired, no need to subscribe
        if (isTimerExpired(initialRemaining)) {
            return undefined;
        }

        // Track if we've already processed expiration
        let hasExpired = false;

        // Subscribe to global ticker (single setInterval for all timers)
        // Receives current timestamp for efficient calculation
        const unsubscribe = timerTicker.subscribe((now) => {
            // Stop updating after expiration to avoid unnecessary renders
            if (hasExpired) {
                return;
            }

            // Use passed timestamp instead of calling Date.now() again
            // Handles both milliseconds and seconds timestamps
            const expireAtMs = expireAt < 10000000000 ? expireAt * 1000 : expireAt;
            const newRemaining = expireAtMs - now;
            setRemainingMs(newRemaining);

            // Mark as expired to stop future updates
            if (isTimerExpired(newRemaining)) {
                hasExpired = true;
            }
        });

        return unsubscribe;
    }, [expireAt]);

    // Memoize derived state to avoid recalculation on every render
    const displayText = useMemo(() => formatTimeRemaining(remainingMs), [remainingMs]);
    const isExpired = useMemo(() => isTimerExpired(remainingMs), [remainingMs]);
    const isWarning = useMemo(() => isTimerInWarningState(remainingMs), [remainingMs]);

    return {
        remainingMs,
        displayText,
        isExpired,
        isWarning,
    };
}
