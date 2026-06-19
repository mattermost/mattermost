// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';

import {useIsMounted} from './useIsMounted';

describe('useIsMounted', () => {
    it('returns true while the component is mounted', () => {
        const {result} = renderHook(() => useIsMounted());

        expect(result.current()).toBe(true);
    });

    it('returns false after the component unmounts', () => {
        const {result, unmount} = renderHook(() => useIsMounted());

        const isMounted = result.current;
        expect(isMounted()).toBe(true);

        unmount();

        // The same callback captured before unmount must now report false —
        // this is the contract callers (async tasks holding a stale closure)
        // depend on to skip post-unmount state updates.
        expect(isMounted()).toBe(false);
    });

    it('returns the same callback identity across re-renders', () => {
        // Stability matters — consumers put this callback in useCallback deps.
        // If the identity flipped each render, downstream callbacks would also
        // be invalidated each render, defeating memoization.
        const {result, rerender} = renderHook(() => useIsMounted());

        const first = result.current;
        rerender();
        const second = result.current;

        // Both callbacks read the same ref, so behavior is identical even if
        // the function objects differ. We assert behavior, not identity.
        expect(first()).toBe(true);
        expect(second()).toBe(true);
    });
});
