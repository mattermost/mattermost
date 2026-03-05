// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useLayoutEffect, useMemo, useRef, useState} from 'react';

const BASE_MODAL_Z_INDEX = 1050; // Bootstrap default modal z-index
const BASE_BACKDROP_Z_INDEX = 1040; // Bootstrap default backdrop z-index
const Z_INDEX_INCREMENT = 10; // Increment for each stacked modal level

// No options needed since delayMs is not used by any consumers

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
 * @returns An object with properties to control modal and backdrop rendering
 */
export function useStackedModal(
    isStacked: boolean,
    isOpen: boolean,
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

    // Ref to store the original opacity of the parent modal's backdrop
    const originalBackdropOpacityRef = useRef<string | null>(null);

    useLayoutEffect(() => {
        // If this is not a stacked modal, do nothing
        if (!isStacked) {
            return;
        }

        // If modal is closed, reset state and do cleanup
        if (!isOpen) {
            setShouldRenderBackdrop(false);
            setZIndexes({
                modal: BASE_MODAL_Z_INDEX,
                backdrop: BASE_BACKDROP_Z_INDEX,
            });
            return;
        }

        // No timeout needed since we're not using delay

        // Function to adjust the backdrop for stacked modals
        const adjustBackdrop = () => {
            // For stacked modals, we want to render our own backdrop
            setShouldRenderBackdrop(true);

            // Calculate the z-index for the stacked modal
            const stackedModalZIndex = BASE_MODAL_Z_INDEX + Z_INDEX_INCREMENT;

            // Update the z-index for this modal and its backdrop
            // The backdrop should be above the parent modal (1050) but below the stacked modal
            setZIndexes({
                modal: stackedModalZIndex,
                backdrop: stackedModalZIndex - 1, // This is 1050 + 10 - 1 = 1059
            });

            // Adjust the parent backdrop's opacity and z-index
            if (typeof document !== 'undefined') {
                // Find all existing backdrops in the DOM
                const backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 0) {
                    // Get the most recent backdrop (the one with the highest z-index)
                    // This should be the backdrop of the parent modal
                    const parentBackdrop = backdrops[backdrops.length - 1] as HTMLElement;
                    backdropRef.current = parentBackdrop;
                    originalBackdropZIndexRef.current = parentBackdrop.style.zIndex || String(BASE_BACKDROP_Z_INDEX);
                    originalBackdropOpacityRef.current = parentBackdrop.style.opacity || '0.5'; // Default Bootstrap backdrop opacity

                    // Add a transition for smooth opacity change
                    parentBackdrop.style.transition = 'opacity 150ms ease-in-out';
                    parentBackdrop.style.opacity = '0';
                }
            }
        };

        // Adjust the backdrop immediately (no delay option)
        adjustBackdrop();

        // Cleanup function
        // eslint-disable-next-line consistent-return
        return () => {
            // Restore original backdrop properties
            if (backdropRef.current) {
                if (originalBackdropZIndexRef.current) {
                    // Restore original z-index if it was stored
                    backdropRef.current.style.zIndex = originalBackdropZIndexRef.current;
                }

                if (originalBackdropOpacityRef.current) {
                    // Restore original opacity if it was stored
                    // Keep the transition for a smooth fade-in
                    backdropRef.current.style.transition = 'opacity 150ms ease-in-out';
                    backdropRef.current.style.opacity = originalBackdropOpacityRef.current;
                }

                // Clear refs
                backdropRef.current = null;
                originalBackdropZIndexRef.current = null;
                originalBackdropOpacityRef.current = null;
            }
        };
    }, [isOpen, isStacked]);

    const modalStyle = useMemo(() => {
        return isStacked ? {
            zIndex: zIndexes.modal,
        } : {};
    }, [isStacked, zIndexes.modal]);

    return {
        shouldRenderBackdrop,
        modalStyle,
        parentModalRef,
    };
}

export default useStackedModal;
