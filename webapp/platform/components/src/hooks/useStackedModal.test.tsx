// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, render, screen} from '@testing-library/react';
import React, {useState} from 'react';

import {useStackedModal} from './useStackedModal';

import {GenericModal} from '../generic_modal/generic_modal';
import {wrapIntl} from '../testUtils';

// Z-index constants from the hook implementation
const BASE_MODAL_Z_INDEX = 1050;
const Z_INDEX_INCREMENT = 10;

// The mock below installs two `.modal-backdrop` elements, so a stacked
// modal rendered under it sits at stacking depth 2.
const MOCK_STACK_DEPTH = 2;

// Mock component that directly uses the useStackedModal hook
const TestComponent = ({
    isStacked = false,
    isOpen = true,
    container,
}: {
    isStacked?: boolean;
    isOpen?: boolean;
    container?: HTMLElement | null;
}) => {
    const {shouldRenderBackdrop, modalStyle, backdropStyle} = useStackedModal(isStacked, isOpen, container);

    return (
        <div data-testid='test-component'>
            <div data-testid='should-render-backdrop'>{shouldRenderBackdrop.toString()}</div>
            <div data-testid='modal-z-index'>{modalStyle.zIndex || 'none'}</div>
            <div data-testid='backdrop-z-index'>{backdropStyle?.zIndex ?? 'none'}</div>
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
            expect(screen.getByTestId('backdrop-z-index')).toHaveTextContent('none');
        });

        test('stacked modals should have increased z-index scaled by stacking depth', () => {
            render(<TestComponent isStacked={true}/>);

            // z-index scales with the number of modals beneath this one
            // so each level sits above the previous stacked modal.
            const expectedZIndex = BASE_MODAL_Z_INDEX + (MOCK_STACK_DEPTH * Z_INDEX_INCREMENT);
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

        test('stacked modals place their backdrop just below their own modal', () => {
            render(<TestComponent isStacked={true}/>);

            // The backdrop must sit one below the stacked modal: high
            // enough to dim the modal directly beneath it, low enough to
            // stay behind this modal's own content.
            const stackedModalZIndex = BASE_MODAL_Z_INDEX + (MOCK_STACK_DEPTH * Z_INDEX_INCREMENT);
            expect(screen.getByTestId('modal-z-index')).toHaveTextContent(stackedModalZIndex.toString());
            expect(screen.getByTestId('backdrop-z-index')).toHaveTextContent((stackedModalZIndex - 1).toString());
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

// Rendered against the real DOM (no querySelectorAll mock) so the hook
// sees the actual backdrop elements each stacked modal creates. This
// covers stacks deeper than one level, which is where a fixed z-index
// offset silently broke: the deepest modal's backdrop landed below the
// modal beneath it and left that modal undimmed (regression: Channel
// Settings → Simulate access → Decision details flashed the middle
// modal to full brightness while the details modal was open).
describe('useStackedModal - multi-level stacking (integration)', () => {
    const flush = async () => {
        await act(async () => {
            await Promise.resolve();
        });
    };

    function StackHarness() {
        const [showMiddle, setShowMiddle] = useState(false);
        const [showDeepest, setShowDeepest] = useState(false);
        return (
            <>
                <button onClick={() => setShowMiddle(true)}>{'open-middle'}</button>
                <button onClick={() => setShowDeepest(true)}>{'open-deepest'}</button>
                <GenericModal
                    show={true}
                    onHide={jest.fn()}
                    modalHeaderText='Base'
                    id='baseModal'
                >
                    <div>base body</div>
                </GenericModal>
                {showMiddle ? (
                    <GenericModal
                        show={true}
                        onHide={jest.fn()}
                        modalHeaderText='Middle'
                        id='middleModal'
                        isStacked={true}
                    >
                        <div>middle body</div>
                    </GenericModal>
                ) : null}
                {showDeepest ? (
                    <GenericModal
                        show={true}
                        onHide={jest.fn()}
                        modalHeaderText='Deepest'
                        id='deepestModal'
                        isStacked={true}
                    >
                        <div>deepest body</div>
                    </GenericModal>
                ) : null}
            </>
        );
    }

    const zIndexOf = (id: string): number => {
        const el = document.getElementById(id) as HTMLElement | null;
        return el ? parseInt(el.style.zIndex || '1050', 10) : NaN;
    };

    const topBackdrop = (): HTMLElement => {
        const backdrops = document.querySelectorAll<HTMLElement>('.modal-backdrop');
        return backdrops[backdrops.length - 1];
    };

    test('a third-level stacked modal dims the modal directly beneath it', async () => {
        render(wrapIntl(<StackHarness/>));
        await flush();

        act(() => {
            screen.getByText('open-middle').click();
        });
        await flush();

        // Second level: the middle modal sits above the base modal and
        // its backdrop dims the base modal.
        expect(zIndexOf('middleModal')).toBeGreaterThan(zIndexOf('baseModal'));

        act(() => {
            screen.getByText('open-deepest').click();
        });
        await flush();

        const deepestModalZ = zIndexOf('deepestModal');
        const middleModalZ = zIndexOf('middleModal');
        const deepestBackdrop = topBackdrop();
        const deepestBackdropZ = parseInt(deepestBackdrop.style.zIndex || '0', 10);

        // The deepest modal stacks above the middle modal...
        expect(deepestModalZ).toBeGreaterThan(middleModalZ);

        // ...and its backdrop is sandwiched between them, so the middle
        // modal is dimmed instead of showing through at full brightness.
        expect(deepestBackdropZ).toBeGreaterThan(middleModalZ);
        expect(deepestBackdropZ).toBeLessThan(deepestModalZ);

        // The dimming layer is actually visible (not the transparent
        // backdrop the close-flash fix parks the covered modal at).
        expect(deepestBackdrop.style.opacity).not.toBe('0');
    });
});

// A document-wide `.modal-backdrop` query can't tell two independent
// modal stacks apart: a second stack's backdrops would inflate this
// stack's computed depth (pushing its z-index too high) and its most
// recent backdrop could be grabbed as this stack's parent and wrongly
// dimmed. Passing each modal's own portal container scopes discovery to
// that stack so the two never interfere. (CodeRabbit review: scope
// backdrop discovery to the current stack/container.)
describe('useStackedModal - independent simultaneous stacks (scoped discovery)', () => {
    const BACKDROP_Z_INDEX = 1040;

    const addBackdrops = (container: HTMLElement, count: number): HTMLElement[] => {
        const created: HTMLElement[] = [];
        for (let i = 0; i < count; i++) {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.style.zIndex = String(BACKDROP_Z_INDEX);
            backdrop.style.opacity = '0.5';
            container.appendChild(backdrop);
            created.push(backdrop);
        }
        return created;
    };

    let containerA: HTMLElement;
    let containerB: HTMLElement;
    let backdropsA: HTMLElement[];
    let backdropsB: HTMLElement[];

    beforeEach(() => {
        containerA = document.createElement('div');
        containerB = document.createElement('div');
        document.body.appendChild(containerA);
        document.body.appendChild(containerB);

        // Stack A has one modal beneath it (depth 1); stack B has two
        // (depth 2). If discovery were document-wide, BOTH stacked modals
        // would see all three backdrops and wrongly compute depth 3.
        backdropsA = addBackdrops(containerA, 1);
        backdropsB = addBackdrops(containerB, 2);
    });

    afterEach(() => {
        containerA.remove();
        containerB.remove();
    });

    test('each stack derives its depth from only its own container backdrops', () => {
        const {rerender} = render(<TestComponent isStacked={true} container={containerA}/>);

        // Depth 1 from container A's single backdrop → not depth 3.
        expect(screen.getByTestId('modal-z-index')).toHaveTextContent(
            (BASE_MODAL_Z_INDEX + Z_INDEX_INCREMENT).toString(),
        );

        rerender(<TestComponent isStacked={true} container={containerB}/>);

        // Depth 2 from container B's two backdrops → still isolated from A.
        expect(screen.getByTestId('modal-z-index')).toHaveTextContent(
            (BASE_MODAL_Z_INDEX + (2 * Z_INDEX_INCREMENT)).toString(),
        );
    });

    test('a stacked modal only dims the parent backdrop in its own container', () => {
        render(<TestComponent isStacked={true} container={containerA}/>);

        // Stack A's most recent backdrop is dimmed...
        expect(backdropsA[backdropsA.length - 1].style.opacity).toBe('0');

        // ...while the unrelated stack B's backdrops are left untouched.
        for (const backdrop of backdropsB) {
            expect(backdrop.style.opacity).toBe('0.5');
        }
    });
});
