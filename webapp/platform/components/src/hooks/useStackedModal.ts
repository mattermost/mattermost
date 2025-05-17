// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useLayoutEffect, useRef, useState} from 'react';

// Z-index values
const BASE_MODAL_Z_INDEX = 1050; // Bootstrap default modal z-index
const BASE_BACKDROP_Z_INDEX = 1040; // Bootstrap default backdrop z-index
const Z_INDEX_INCREMENT = 10; // Increment for each stacked modal level

type StackedModalOptions = {

    /**
     * Optional delay in milliseconds before adjusting the backdrop.
     * Useful when the modal has animations or transitions.
     */
    delayMs?: number;
};

type StackedModalResult = {

    /**
     * Whether the modal should render its own backdrop
     */
    shouldRenderBackdrop: boolean;

    /**
     * Style object for the modal element
     */
    modalStyle: React.CSSProperties;

    /**
     * Reference to the parent modal element (if this is a stacked modal)
     */
    parentModalRef: React.RefObject<HTMLElement | null>;
};

/**
 * A hook that manages stacked modals, controlling backdrop visibility and z-index values.
 *
 * @param isStacked Whether this modal is stacked on top of another modal
 * @param isOpen Whether the modal is currently open
 * @param modalRef A ref to the modal element
 * @param options Configuration options
 * @returns An object with properties to control modal and backdrop rendering
 */
export function useStackedModal(
    isStacked: boolean,
    isOpen: boolean,
    modalRef: React.RefObject<HTMLElement>,
    options: StackedModalOptions = {},
): StackedModalResult {
    // State to track whether this modal should render its own backdrop
    const [shouldRenderBackdrop, setShouldRenderBackdrop] = useState(!isStacked);

    // State to track z-index values
    const [zIndexes, setZIndexes] = useState({
        modal: BASE_MODAL_Z_INDEX,
        backdrop: BASE_BACKDROP_Z_INDEX,
    });

    // Ref to store the parent modal element
    const parentModalRef = useRef<HTMLElement | null>(null);

    // Ref to store the original z-index of the parent modal's backdrop
    const originalBackdropZIndexRef = useRef<string | null>(null);

    // Ref to store the parent modal's backdrop element
    const backdropRef = useRef<HTMLElement | null>(null);

    useLayoutEffect(() => {
        // If this is not a stacked modal or not open, do nothing
        if (!isStacked || !isOpen) {
            return;
        }

        let timeoutId: NodeJS.Timeout | null = null;

        // Function to adjust the backdrop for stacked modals
        const adjustBackdrop = () => {
            // For stacked modals, we don't want to render our own backdrop
            setShouldRenderBackdrop(false);

            // Calculate the z-index for the stacked modal
            const stackedModalZIndex = BASE_MODAL_Z_INDEX + Z_INDEX_INCREMENT;

            // Update the z-index for this modal
            setZIndexes({
                modal: stackedModalZIndex,
                backdrop: stackedModalZIndex - 1, // Not used directly, but kept for consistency
            });

            // In a real browser environment, we would also adjust the parent backdrop's z-index
            if (typeof document !== 'undefined' && document.querySelector) {
                // Find the existing backdrop in the DOM
                const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;
                if (backdrop) {
                    // Store the backdrop and its original z-index
                    backdropRef.current = backdrop;
                    originalBackdropZIndexRef.current = backdrop.style.zIndex || String(BASE_BACKDROP_Z_INDEX);

                    // Increase the z-index of the backdrop to be above the parent modal
                    // but below this modal
                    const backdropZIndex = stackedModalZIndex - 1;
                    backdrop.style.zIndex = String(backdropZIndex);
                } else {
                    // If we can't find a backdrop element, we still want to ensure
                    // that shouldRenderBackdrop is set correctly for stacked modals
                    setShouldRenderBackdrop(false);
                }
            }
        };

        // Adjust the backdrop, with optional delay
        if (options.delayMs && options.delayMs > 0) {
            timeoutId = setTimeout(adjustBackdrop, options.delayMs);
        } else {
            adjustBackdrop();
        }

        // Cleanup function
        // eslint-disable-next-line consistent-return
        return () => {
            // Clear timeout if component unmounts during delay
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Restore original backdrop z-index
            if (backdropRef.current && originalBackdropZIndexRef.current) {
                backdropRef.current.style.zIndex = originalBackdropZIndexRef.current;
                backdropRef.current = null;
                originalBackdropZIndexRef.current = null;
            }
        };
    }, [isOpen, isStacked, options.delayMs]);

    return {
        shouldRenderBackdrop,
        modalStyle: isStacked ? {
            zIndex: zIndexes.modal,
        } : {},
        parentModalRef,
    };
}

export default useStackedModal;
