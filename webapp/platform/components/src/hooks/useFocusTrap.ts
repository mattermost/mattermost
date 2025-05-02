// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';

// A global stack to hold active focus trap containers.
// This ensures that only the topmost trap processes Tab events.
const activeFocusTraps: HTMLElement[] = [];

type FocusTrapOptions = {
    initialFocus?: boolean;
    restoreFocus?: boolean;
    delayMs?: number; // Delay in milliseconds before activating the focus trap
};

/**
 * A hook that traps focus within a container element.
 * When multiple focus traps are active, only the topmost one will process Tab key events.
 * @param isActive Whether the focus trap is active
 * @param containerRef A ref to the container element
 * @param options FocusTrapOptions Options for the focus trap
 * @returns void
 */
export function useFocusTrap(
    isActive: boolean,
    containerRef: React.RefObject<HTMLElement>,
    options: FocusTrapOptions = {initialFocus: false, restoreFocus: false},
): void {
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Add a ref to store the cached focusable elements
    const focusableElementsRef = useRef<HTMLElement[]>([]);

    useEffect(() => {
        const container = containerRef.current;
        if (!isActive || !container) {
            return;
        }

        // Store the previously focused element for restoration if needed
        if (options.restoreFocus) {
            previousFocusRef.current = document.activeElement as HTMLElement;
        }

        let timeoutId: NodeJS.Timeout | null = null;
        let trapActive = false;

        // Function to cache focusable elements and activate the trap
        const activateFocusTrap = () => {
            // Cache the focusable elements
            focusableElementsRef.current = getFocusableElements(container);

            // Register this focus trap (push it onto the global stack)
            activeFocusTraps.push(container);
            trapActive = true;

            if (focusableElementsRef.current.length === 0) {
                return;
            }

            // Set initial focus if needed
            if (options.initialFocus && focusableElementsRef.current.length > 0) {
                focusableElementsRef.current[0].focus();
            }
        };

        // Function to refresh the cached elements if needed
        const refreshFocusableElements = () => {
            focusableElementsRef.current = getFocusableElements(container);
        };

        // Delay the activation if delayMs is specified
        if (options.delayMs && options.delayMs > 0) {
            timeoutId = setTimeout(activateFocusTrap, options.delayMs);
        } else {
            // Activate immediately if no delay
            activateFocusTrap();
        }

        // Handle tab key navigation - only trap Tab key, let other keys propagate
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle Tab key for focus trapping
            if (e.key !== 'Tab') {
                return;
            }

            // Only process if this container is the top-most active focus trap
            // AND if the focus trap has been activated (after delay)
            if (!trapActive || activeFocusTraps[activeFocusTraps.length - 1] !== container) {
                return;
            }

            // Use the cached focusable elements
            const elements = focusableElementsRef.current;
            if (elements.length === 0) {
                return;
            }

            const firstElement = elements[0];
            const lastElement = elements[elements.length - 1];

            // If shift+tab on first element, move to last element
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) { // If tab on last element, move to first element
                e.preventDefault();
                firstElement.focus();
            }
        };

        // Set up a MutationObserver to detect DOM changes that might affect focusable elements
        const observer = new MutationObserver(() => {
            // Only refresh if the trap is active
            if (trapActive) {
                refreshFocusableElements();
            }
        });

        // Start observing the container for changes that might affect focusability
        observer.observe(container, {
            childList: true, // Watch for changes to child elements
            subtree: true, // Watch the entire subtree
            attributes: true, // Watch for attribute changes
            attributeFilter: ['tabindex', 'disabled'], // Only care about attributes that affect focusability
        });

        document.addEventListener('keydown', handleKeyDown);

        // Cleanup function
        // eslint-disable-next-line consistent-return
        return () => {
            // Clear the timeout if component unmounts during delay
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Stop the observer
            observer.disconnect();

            document.removeEventListener('keydown', handleKeyDown);

            // Only remove from stack if it was actually added
            if (trapActive) {
                const index = activeFocusTraps.indexOf(container);
                if (index > -1) {
                    activeFocusTraps.splice(index, 1);
                }
            }

            // Restore focus when trap is deactivated
            if (options.restoreFocus && previousFocusRef.current) {
                previousFocusRef.current.focus();
            }
        };
    }, [isActive, containerRef, options.initialFocus, options.restoreFocus, options.delayMs]);
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
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];

    // Filter out hidden elements
    return elements.filter((element) => isElementVisible(element));
}

/**
 * Checks if an element is visible in the DOM
 * @param element The element to check
 * @returns true if the element is visible, false otherwise
 */
function isElementVisible(element: HTMLElement): boolean {
    // Check if the element has zero dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
        return false;
    }

    // Check computed styles for this element and its ancestors
    let currentElement: HTMLElement | null = element;
    while (currentElement) {
        const style = window.getComputedStyle(currentElement);

        // Check common ways elements can be hidden
        if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            currentElement.hasAttribute('hidden')
        ) {
            return false;
        }

        currentElement = currentElement.parentElement;
    }

    return true;
}
