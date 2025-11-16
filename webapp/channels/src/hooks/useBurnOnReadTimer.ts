// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState, useRef} from 'react';

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
    onExpire?: () => void;
}

/**
 * Hook to manage burn-on-read countdown timer
 * Updates every second and triggers expiration callback
 */
export function useBurnOnReadTimer({expireAt, onExpire}: UseBurnOnReadTimerOptions): TimerState {
    const [remainingMs, setRemainingMs] = useState<number>(() => {
        if (!expireAt) {
            return 0;
        }
        return calculateRemainingTime(expireAt);
    });

    const onExpireRef = useRef(onExpire);
    onExpireRef.current = onExpire;

    const hasExpiredRef = useRef(false);

    // Update timer every second
    useEffect(() => {
        if (!expireAt) {
            return undefined;
        }

        // Initial calculation
        const initialRemaining = calculateRemainingTime(expireAt);
        setRemainingMs(initialRemaining);

        // Check if already expired
        if (isTimerExpired(initialRemaining) && !hasExpiredRef.current) {
            hasExpiredRef.current = true;
            if (onExpireRef.current) {
                onExpireRef.current();
            }
            return undefined;
        }

        // Set up interval
        const interval = setInterval(() => {
            const newRemaining = calculateRemainingTime(expireAt);
            setRemainingMs(newRemaining);

            // Trigger expiration callback
            if (isTimerExpired(newRemaining) && !hasExpiredRef.current) {
                hasExpiredRef.current = true;
                clearInterval(interval);
                if (onExpireRef.current) {
                    onExpireRef.current();
                }
            }
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [expireAt]);

    // Calculate derived state
    const displayText = formatTimeRemaining(remainingMs);
    const isExpired = isTimerExpired(remainingMs);
    const isWarning = isTimerInWarningState(remainingMs);

    return {
        remainingMs,
        displayText,
        isExpired,
        isWarning,
    };
}
