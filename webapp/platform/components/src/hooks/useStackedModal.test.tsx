// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import {useStackedModal} from './useStackedModal';

import {GenericModal} from '../generic_modal/generic_modal';
import {wrapIntl} from '../testUtils';

// Z-index constants from the hook implementation
const BASE_MODAL_Z_INDEX = 1050;
const Z_INDEX_INCREMENT = 10;

// Mock component that directly uses the useStackedModal hook
const TestComponent = ({
    isStacked = false,
    isOpen = true,
}) => {
    const {shouldRenderBackdrop, modalStyle} = useStackedModal(isStacked, isOpen);

    return (
        <div data-testid='test-component'>
            <div data-testid='should-render-backdrop'>{shouldRenderBackdrop.toString()}</div>
            <div data-testid='modal-z-index'>{modalStyle.zIndex || 'none'}</div>
            <div>Modal Content</div>
        </div>
    );
};

describe('useStackedModal', () => {
    // Mock document.querySelectorAll for backdrop tests
    let originalQuerySelectorAll: typeof document.querySelectorAll;
    let mockBackdrop1: HTMLElement;
    let mockBackdrop2: HTMLElement;

    beforeEach(() => {
        // Save original implementation
        originalQuerySelectorAll = document.querySelectorAll;

        // Create mock backdrop elements
        mockBackdrop1 = document.createElement('div');
        mockBackdrop1.className = 'modal-backdrop';
        mockBackdrop1.style.zIndex = '1040'; // Bootstrap default
        mockBackdrop1.style.opacity = '0.5'; // Bootstrap default

        mockBackdrop2 = document.createElement('div');
        mockBackdrop2.className = 'modal-backdrop';
        mockBackdrop2.style.zIndex = '1045'; // Higher z-index for the second backdrop
        mockBackdrop2.style.opacity = '0.5'; // Bootstrap default

        document.querySelectorAll = jest.fn().mockImplementation((selector: string) => {
            if (selector === '.modal-backdrop') {
                return [mockBackdrop1, mockBackdrop2]; // Return multiple backdrops to simulate stacked modals
            }
            return [];
        });
    });

    afterEach(() => {
        // Restore original implementation
        document.querySelectorAll = originalQuerySelectorAll;
    });

    describe('Integration Tests', () => {
        test('does not affect regular modals', () => {
            const props = {
                show: true,
                onHide: jest.fn(),
                modalHeaderText: 'Regular Modal',
                children: <div>Regular Modal Content</div>,
            };

            render(
                wrapIntl(<GenericModal {...props}/>),
            );

            // The modal should be in the document
            expect(screen.getByText('Regular Modal')).toBeInTheDocument();
            expect(screen.getByText('Regular Modal Content')).toBeInTheDocument();

            // Regular modals should have a backdrop
            // We can't directly test the backdrop since it's controlled by react-bootstrap
            // But we can verify the modal displayed correctly and has the expected aria attributes
            expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        });

        test('stacked modals have shouldRenderBackdrop=true but pass backdrop=false to Modal', () => {
            const props = {
                show: true,
                onHide: jest.fn(),
                modalHeaderText: 'Stacked Modal',
                isStacked: true,
                children: <div>Stacked Modal Content</div>,
            };

            render(
                wrapIntl(<GenericModal {...props}/>),
            );

            // The modal should be in the document
            expect(screen.getByText('Stacked Modal')).toBeInTheDocument();
            expect(screen.getByText('Stacked Modal Content')).toBeInTheDocument();

            // We can't directly test the backdrop since it's controlled by react-bootstrap
            // But we can verify the modal displayed correctly and has the expected aria attributes
            expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        });

        test('stacked modals do not render their own backdrop', () => {
            // This test verifies that stacked modals don't render their own backdrop through GenericModal
            const stackedProps = {
                show: true,
                onHide: jest.fn(),
                modalHeaderText: 'Stacked Modal',
                id: 'stackedModal',
                isStacked: true,
                children: <div>Stacked Modal Content</div>,
            };

            render(
                wrapIntl(<GenericModal {...stackedProps}/>),
            );

            // The modal should be in the document
            expect(screen.getByText('Stacked Modal')).toBeInTheDocument();
            expect(screen.getByText('Stacked Modal Content')).toBeInTheDocument();

            // The modal should have aria-modal="true"
            expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        });
    });

    describe('Direct Hook Tests - Basic Functionality', () => {
        test('regular modals should render their own backdrop', () => {
            render(<TestComponent isStacked={false}/>);

            expect(screen.getByTestId('should-render-backdrop')).toHaveTextContent('true');
            expect(screen.getByTestId('modal-z-index')).toHaveTextContent('none');
        });

        test('stacked modals should have increased z-index', () => {
            render(<TestComponent isStacked={true}/>);

            // Verify exact z-index calculation
            const expectedZIndex = BASE_MODAL_Z_INDEX + Z_INDEX_INCREMENT;
            expect(screen.getByTestId('modal-z-index')).toHaveTextContent(expectedZIndex.toString());
        });
    });

    describe('Direct Hook Tests - Backdrop Manipulation', () => {
        test('stacked modals should modify parent backdrop opacity', () => {
            render(<TestComponent isStacked={true}/>);

            // The hook should have modified the most recent backdrop (mockBackdrop2)
            expect(mockBackdrop2.style.opacity).toBe('0');
        });

        test('stacked modals should set transition property on parent backdrop', () => {
            render(<TestComponent isStacked={true}/>);

            // Verify the transition property is set correctly
            expect(mockBackdrop2.style.transition).toBe('opacity 150ms ease-in-out');
        });

        test('stacked modals should calculate backdrop z-index correctly', () => {
            render(<TestComponent isStacked={true}/>);

            // The hook should calculate the backdrop z-index as stackedModalZIndex - 1
            // Where stackedModalZIndex = BASE_MODAL_Z_INDEX + Z_INDEX_INCREMENT
            const expectedBackdropZIndex = (BASE_MODAL_Z_INDEX + Z_INDEX_INCREMENT) - 1;

            // We can't directly test this since the hook doesn't expose the backdrop z-index,
            // but we can verify the hook's behavior by checking the modalStyle z-index
            // and inferring that the backdrop z-index would be one less
            const modalZIndex = parseInt(screen.getByTestId('modal-z-index').textContent || '0', 10);
            expect(modalZIndex - 1).toBe(expectedBackdropZIndex);
        });

        test('cleanup should restore original backdrop properties', () => {
            const {unmount} = render(<TestComponent isStacked={true}/>);

            // The hook should have modified the parent backdrop
            expect(mockBackdrop2.style.opacity).toBe('0');

            // Unmount to trigger cleanup
            unmount();

            // Original opacity should be restored
            expect(mockBackdrop2.style.opacity).toBe('0.5');

            // The standard transition is re-enabled after the restore so any
            // LATER opacity change (e.g. the parent modal's own close) still
            // animates. It is not used for the restore itself — that snaps
            // instantly; see the "snaps the parent backdrop opacity" test.
            expect(mockBackdrop2.style.transition).toBe('opacity 150ms ease-in-out');
        });

        test('cleanup snaps the parent backdrop opacity back without animating (no close-time flash)', () => {
            // Regression guard for the stacked-modal close flash: when a
            // stacked modal closes, its own backdrop is removed instantly.
            // If the parent backdrop opacity is animated back up from 0 over
            // 150ms, there is a window with no opaque overlay and the whole
            // screen flashes bright. The restore must therefore be a snap
            // (transition disabled) so the dimming stays continuous.
            //
            // Use a non-default original opacity so the assertions also prove
            // the restore reuses the STORED value rather than a hardcoded one.
            const style = mockBackdrop2.style;
            style.opacity = '0.7';

            // Record every style write in order, tagging each opacity write
            // with the transition value in effect at that instant. A correct
            // fix restores the original opacity while transitions are
            // disabled; the buggy version restored it while a 150ms opacity
            // transition was live.
            let opacityVal = style.opacity;
            let transitionVal = style.transition;
            const writes: Array<{prop: 'opacity' | 'transition'; value: string; transitionInEffect?: string}> = [];

            Object.defineProperty(style, 'opacity', {
                configurable: true,
                get: () => opacityVal,
                set: (v: string) => {
                    writes.push({prop: 'opacity', value: v, transitionInEffect: transitionVal});
                    opacityVal = v;
                },
            });
            Object.defineProperty(style, 'transition', {
                configurable: true,
                get: () => transitionVal,
                set: (v: string) => {
                    writes.push({prop: 'transition', value: v});
                    transitionVal = v;
                },
            });

            const {unmount} = render(<TestComponent isStacked={true}/>);
            unmount();

            // The final restore writes the stored original opacity back (0.7),
            // proving the hook reuses the captured value, not a default.
            const restoreWrite = [...writes].reverse().find((w) => w.prop === 'opacity' && w.value === '0.7');
            expect(restoreWrite).toBeDefined();

            // Critically, that restore happens with transitions disabled so it
            // snaps instead of fading in (the fade-in is what caused the flash).
            expect(restoreWrite?.transitionInEffect).toBe('none');

            // Lock in the cleanup ordering: transitions are disabled, THEN the
            // opacity is snapped back, THEN the standard transition is
            // re-enabled for future changes. (The forced reflow between the
            // snap and the re-enable is a no-op in jsdom, so this ordering
            // assertion is the closest available proxy for "no fade-in".)
            const cleanupWrites = writes.slice(writes.findIndex((w) => w.prop === 'transition' && w.value === 'none'));
            expect(cleanupWrites.map((w) => `${w.prop}:${w.value}`)).toEqual([
                'transition:none',
                'opacity:0.7',
                'transition:opacity 150ms ease-in-out',
            ]);

            expect(style.opacity).toBe('0.7');
            expect(style.transition).toBe('opacity 150ms ease-in-out');
        });
    });
});
