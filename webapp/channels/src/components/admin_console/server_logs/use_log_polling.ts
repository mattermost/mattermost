// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef, useState} from 'react';

type UseLogPollingOptions = {
    fetchLogs: () => Promise<void>;
    enabled: boolean;
    intervalMs: number;
};

export default function useLogPolling({fetchLogs, enabled, intervalMs}: UseLogPollingOptions) {
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fetchRef = useRef(fetchLogs);
    const isPollingRef = useRef(false);
    fetchRef.current = fetchLogs;

    const stop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            stop();
            return undefined;
        }

        const tick = async () => {
            if (document.hidden || isPollingRef.current) {
                return;
            }
            isPollingRef.current = true;
            try {
                await fetchRef.current();
                setLastUpdated(Date.now());
            } finally {
                isPollingRef.current = false;
            }
        };

        // Immediate fetch when enabling
        tick();

        intervalRef.current = setInterval(tick, intervalMs);

        return stop;
    }, [enabled, intervalMs, stop]);

    // Pause when tab is hidden
    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stop();
            } else if (!intervalRef.current) {
                // Resume polling when tab becomes visible again (only if not already running)
                const tick = async () => {
                    if (isPollingRef.current) {
                        return;
                    }
                    isPollingRef.current = true;
                    try {
                        await fetchRef.current();
                        setLastUpdated(Date.now());
                    } finally {
                        isPollingRef.current = false;
                    }
                };
                tick();
                intervalRef.current = setInterval(tick, intervalMs);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, intervalMs, stop]);

    return {lastUpdated};
}
