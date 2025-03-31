// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';

/**
 * A hook that traps focus within a container element.
 * @param isActive Whether the focus trap is active
 * @param containerRef A ref to the container element
 * @param options Options for the focus trap
 * @returns void
 */
export function useFocusTrap(
    isActive: boolean,
    containerRef: React.RefObject<HTMLElement>,
    options = {initialFocus: false, restoreFocus: false},
): void {
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) {
            return;
        }

        // Store the previously focused element to restore later
        if (options.restoreFocus) {
            previousFocusRef.current = document.activeElement as HTMLElement;
        }

        // Get all focusable elements
        const focusableElements = getFocusableElements(containerRef.current);

        if (focusableElements.length === 0) {
            return;
        }

        // Set initial focus if needed
        if (options.initialFocus && focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        // Handle tab key navigation - only trap Tab key, let other keys propagate
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle Tab key for focus trapping
            if (e.key !== 'Tab') {
                return;
            }

            const focusableElements = getFocusableElements(containerRef.current!);
            if (focusableElements.length === 0) {
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // If shift+tab on first element, move to last element
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) { // If tab on last element, move to first element
                e.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Cleanup function
        // eslint-disable-next-line consistent-return
        return () => {
            document.removeEventListener('keydown', handleKeyDown);

            // Restore focus when trap is deactivated
            if (options.restoreFocus && previousFocusRef.current) {
                previousFocusRef.current.focus();
            }
        };
    }, [isActive, containerRef, options.initialFocus, options.restoreFocus]);
}

/**
 * Helper function to get all focusable elements within a container
 * @param container The container element
 * @returns An array of focusable elements
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        'area[href]',
    ].join(',');

    const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    return elements;
}
