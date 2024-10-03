// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo, useRef} from 'react';

export function useDelayedAction(ms: number) {
    const delayedAction = useRef<() => void>();
    const timeout = useRef<number>(0);

    const fireNow = useCallback(() => {
        if (timeout.current) {
            clearTimeout(timeout.current);
            timeout.current = 0;
        }

        delayedAction.current?.();
        delayedAction.current = undefined;
    }, []);

    const startTimeout = useCallback((action: () => void) => {
        if (timeout.current) {
            clearTimeout(timeout.current);
            timeout.current = 0;
        }

        delayedAction.current = action;

        timeout.current = window.setTimeout(fireNow, ms);
    }, [fireNow, ms]);

    return useMemo(() => ({
        fireNow,
        startTimeout,
    }), [fireNow, startTimeout]);
}
