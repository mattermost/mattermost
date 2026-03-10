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
            return;
        }

        const tick = async () => {
            if (document.hidden) {
                return;
            }
            await fetchRef.current();
            setLastUpdated(Date.now());
        };

        intervalRef.current = setInterval(tick, intervalMs);

        return stop;
    }, [enabled, intervalMs, stop]);

    // Pause when tab is hidden
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stop();
            } else {
                // Resume polling when tab becomes visible again
                const tick = async () => {
                    await fetchRef.current();
                    setLastUpdated(Date.now());
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
