// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef} from 'react';

export function useIsMounted(): () => boolean {
    const isMountedRef = useRef(true);
    useEffect(() => {
        // Reset to true for React StrictMode (double-invocation unmounts then remounts).
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Stable reference so callers don't need isMounted in their useCallback deps.
    return useCallback(() => isMountedRef.current, []);
}
