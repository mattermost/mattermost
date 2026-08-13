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
     * Style object for the modal's backdrop element. Positions a
     * stacked modal's backdrop just above the modal directly beneath
     * it so that modal is dimmed while this one is open.
     */
    backdropStyle?: React.CSSProperties;

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
 * @param container The DOM element the modal is portaled into. Backdrop
 *  discovery is scoped to this element so an independent modal stack in a
 *  different container can't inflate this modal's stacking depth or have
 *  its backdrop mistaken for this stack's parent. Defaults to the whole
 *  document, which is the single shared stack for the common case where
 *  modals render into `document.body`.
 * @returns An object with properties to control modal and backdrop rendering
 */
export function useStackedModal(
    isStacked: boolean,
    isOpen: boolean,
    container?: HTMLElement | null,
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

            // The stacking depth is the number of backdrops already in
            // the DOM from the modals beneath this one. Each level must
            // sit a full increment above the previous stacked modal:
            // using a fixed offset broke stacks 3+ deep (e.g. Channel
            // Settings → Simulate access → Decision details), where the
            // deepest modal shared the middle modal's z-index and its
            // backdrop landed *below* that modal, leaving it undimmed.
            //
            // Scope the lookup to this modal's own container so a second,
            // independent stack rendered elsewhere in the document can't
            // be counted as part of this stack (which would over-count the
            // depth) or have its backdrop picked as this stack's parent.
            const root: ParentNode | null = container ?? (typeof document === 'undefined' ? null : document);
            const backdrops = root === null ?
                [] :
                Array.from(root.querySelectorAll<HTMLElement>('.modal-backdrop'));
            const depth = Math.max(backdrops.length, 1);

            // The backdrop sits one below the modal so it dims the modal
            // directly beneath this one but stays behind this modal.
            const stackedModalZIndex = BASE_MODAL_Z_INDEX + (depth * Z_INDEX_INCREMENT);
            setZIndexes({
                modal: stackedModalZIndex,
                backdrop: stackedModalZIndex - 1,
            });

            // Adjust the parent backdrop so we don't stack two dim
            // layers over the same content.
            if (backdrops.length > 0) {
                // Get the most recent backdrop (the one with the highest z-index)
                // This should be the backdrop of the parent modal
                const parentBackdrop = backdrops[backdrops.length - 1];
                backdropRef.current = parentBackdrop;
                originalBackdropZIndexRef.current = parentBackdrop.style.zIndex || String(BASE_BACKDROP_Z_INDEX);
                originalBackdropOpacityRef.current = parentBackdrop.style.opacity || '0.5'; // Default Bootstrap backdrop opacity

                // Add a transition for smooth opacity change
                parentBackdrop.style.transition = 'opacity 150ms ease-in-out';
                parentBackdrop.style.opacity = '0';
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
                    const backdrop = backdropRef.current;

                    // Snap the parent backdrop back to its original opacity
                    // WITHOUT a fade-in. The stacked modal's own backdrop is
                    // removed instantly when it closes, so animating the
                    // parent backdrop up from 0 over 150ms leaves a window
                    // with no opaque overlay — the whole screen flashes
                    // bright for that fraction of a second. Restoring the
                    // opacity synchronously keeps the visible dimming
                    // continuous as the stacked backdrop disappears.
                    backdrop.style.transition = 'none';
                    backdrop.style.opacity = originalBackdropOpacityRef.current;

                    // Reading a layout property forces the snap above to
                    // commit before transitions are re-enabled; otherwise the
                    // browser batches both writes and animates the opacity
                    // change, bringing the flash back. offsetHeight is always
                    // non-negative, so this also consumes the forced read.
                    if (backdrop.offsetHeight >= 0) {
                        backdrop.style.transition = 'opacity 150ms ease-in-out';
                    }
                }

                // Clear refs
                backdropRef.current = null;
                originalBackdropZIndexRef.current = null;
                originalBackdropOpacityRef.current = null;
            }
        };
    }, [isOpen, isStacked, container]);

    const modalStyle = useMemo(() => {
        return isStacked ? {
            zIndex: zIndexes.modal,
        } : {};
    }, [isStacked, zIndexes.modal]);

    const backdropStyle = useMemo(() => {
        return isStacked ? {
            zIndex: zIndexes.backdrop,
        } : undefined;
    }, [isStacked, zIndexes.backdrop]);

    return {
        shouldRenderBackdrop,
        modalStyle,
        backdropStyle,
        parentModalRef,
    };
}

export default useStackedModal;
