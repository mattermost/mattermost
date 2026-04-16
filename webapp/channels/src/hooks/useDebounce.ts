// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef} from 'react';

import {useLatest} from './useLatest';

/**
 * Returns a debounced version of the callback with a `.cancel()` method.
 * Based on the mattermost-mobile implementation.
 *
 * The callback is accessed via useLatest ref so the debounced invocation
 * always fires the most recent callback, even if its identity changed.
 */
export function useDebounce<T extends(...args: never[]) => void>(callback: T, delay: number) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbackRef = useLatest(callback);

    const cancel = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // Cancel pending timeout on unmount
    useEffect(() => cancel, [cancel]);

    const execute = useCallback((...args: Parameters<T>) => {
        cancel();
        timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    }, [callbackRef, delay, cancel]) as T;

    return useMemo(() => Object.assign(execute, {cancel}), [execute, cancel]);
}
