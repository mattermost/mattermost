// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef} from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store';

/**
 * Hook that checks if smooth scrolling is enabled via feature flag + user preference.
 *
 * Returns true when both:
 * - Admin has enabled FeatureFlagSmoothScrolling
 * - User hasn't disabled their smooth_scrolling preference (default: enabled)
 */
export function useSmoothScrollingEnabled(): boolean {
    const config = useSelector(getConfig);
    const smoothScrollPref = useSelector((state: GlobalState) =>
        getPreference(state, 'display_settings', 'smooth_scrolling', 'true'),
    );

    const featureEnabled = config?.FeatureFlagSmoothScrolling === 'true';
    const userEnabled = smoothScrollPref !== 'false';

    return featureEnabled && userEnabled;
}

/**
 * Observes an external element (like the AdvancedTextEditor container) for height changes
 * and compensates the scroll container's scrollTop to prevent visual jumping.
 *
 * When PendingRepliesBar appears, the editor grows taller, pushing the post list up.
 * This observer detects that height change and adjusts scrollTop to compensate.
 */
export function useExternalHeightCompensation(
    scrollContainerRef: React.RefObject<HTMLElement>,
    enabled: boolean,
) {
    const lastEditorHeightRef = useRef<number>(0);
    const observerRef = useRef<ResizeObserver | null>(null);

    const observeElement = useCallback((element: HTMLElement | null) => {
        // Clean up previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }

        if (!element || !enabled) {
            return;
        }

        lastEditorHeightRef.current = element.offsetHeight;

        observerRef.current = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) {
                return;
            }

            const newHeight = Math.ceil(entry.borderBoxSize[0].blockSize);
            const delta = newHeight - lastEditorHeightRef.current;
            lastEditorHeightRef.current = newHeight;

            if (delta === 0) {
                return;
            }

            const scrollContainer = scrollContainerRef.current;
            if (!scrollContainer) {
                return;
            }

            // The editor grew (e.g., PendingRepliesBar appeared), so the post list
            // container shrank. The visible content shifted up. We need to scroll up
            // by the same amount to keep the same content visible.
            //
            // The editor shrank (e.g., PendingRepliesBar removed), the post list
            // container grew. The visible content shifted down. Scroll down to compensate.
            //
            // In both cases: scrollTop -= delta (editor grew = positive delta = scroll up)
            requestAnimationFrame(() => {
                scrollContainer.scrollTop -= delta;
            });
        });

        observerRef.current.observe(element);
    }, [enabled, scrollContainerRef]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    return observeElement;
}
