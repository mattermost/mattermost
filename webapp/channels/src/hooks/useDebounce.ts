// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo, useRef} from 'react';

/**
 * Returns a debounced version of the callback with a `.cancel()` method.
 * Based on the mattermost-mobile implementation.
 */
export function useDebounce<T extends(...args: never[]) => void>(callback: T, delay: number) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancel = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const execute = useCallback((...args: Parameters<T>) => {
        cancel();
        timeoutRef.current = setTimeout(() => callback(...args), delay);
    }, [callback, delay, cancel]) as T;

    return useMemo(() => Object.assign(execute, {cancel}), [execute, cancel]);
}
