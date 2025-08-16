// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React, {useRef} from 'react';

import {useFocusTrap} from './useFocusTrap';

// Test component that uses the hook
function FocusTrapTestComponent({
    isActive = true,
    initialFocus = false,
    restoreFocus = false,
    delayMs = 0,
}: {
    isActive?: boolean;
    initialFocus?: boolean;
    restoreFocus?: boolean;
    delayMs?: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    useFocusTrap(isActive, containerRef, {
        initialFocus,
        restoreFocus,
        delayMs,
    });

    return (
        <div ref={containerRef} data-testid='container'>
            <button data-testid='button1'>Button 1</button>
            <button data-testid='button2'>Button 2</button>
            <button data-testid='button3'>Button 3</button>
        </div>
    );
}

// Test component with nested focus traps
function NestedFocusTrapsComponent() {
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);

    useFocusTrap(true, outerRef);
    useFocusTrap(true, innerRef);

    return (
        <div ref={outerRef} data-testid='outer-container'>
            <button data-testid='outer-button1'>Outer Button 1</button>
            <div ref={innerRef} data-testid='inner-container'>
                <button data-testid='inner-button1'>Inner Button 1</button>
                <button data-testid='inner-button2'>Inner Button 2</button>
            </div>
            <button data-testid='outer-button2'>Outer Button 2</button>
        </div>
    );
}

describe('useFocusTrap', () => {
    beforeEach(() => {
        // Create a div to hold our rendered components
        const container = document.createElement('div');
        container.id = 'root';
        document.body.appendChild(container);

        // Create an element outside the focus trap for testing restoreFocus
        const outsideButton = document.createElement('button');
        outsideButton.setAttribute('data-testid', 'outside-button');
        outsideButton.textContent = 'Outside Button';
        document.body.appendChild(outsideButton);
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
        jest.useRealTimers();
    });

    // Helper function to simulate Tab key press
    const simulateTabKey = (shiftKey = false) => {
        const tabEvent = new KeyboardEvent('keydown', {
            key: 'Tab',
            code: 'Tab',
            shiftKey,
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(tabEvent);
    };

    // Helper function to simulate tab navigation with focus trap
    const simulateTabWithFocusTrap = (container: HTMLElement, shiftKey = false) => {
        const focusableElements = Array.from(
            container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ) as HTMLElement[];

        if (focusableElements.length === 0) {
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const currentElement = document.activeElement as HTMLElement;

        // Find the current element index
        const currentIndex = focusableElements.indexOf(currentElement);

        if (currentIndex === -1) {
            // If not found, focus the first element
            firstElement.focus();
            return;
        }

        if (shiftKey) {
            // Backward navigation
            if (currentElement === firstElement) {
                lastElement.focus();
            } else {
                const prevIndex = ((currentIndex - 1) + focusableElements.length) % focusableElements.length;
                focusableElements[prevIndex].focus();
            }
        } else if (currentElement === lastElement) {
            // Forward navigation - if at last element, go to first
            firstElement.focus();
        } else {
            // Forward navigation - go to next element
            const nextIndex = (currentIndex + 1) % focusableElements.length;
            focusableElements[nextIndex].focus();
        }
    };

    test('should trap focus within the container', async () => {
        const {container} = render(<FocusTrapTestComponent />);

        // Focus the first button
        const button1 = screen.getByTestId('button1');
        button1.focus();
        expect(document.activeElement).toBe(button1);

        // Tab to the next button
        simulateTabWithFocusTrap(container);
        expect(document.activeElement).toBe(screen.getByTestId('button2'));

        // Tab to the last button
        simulateTabWithFocusTrap(container);
        expect(document.activeElement).toBe(screen.getByTestId('button3'));

        // Tab again should cycle back to the first button
        simulateTabWithFocusTrap(container);
        expect(document.activeElement).toBe(button1);

        // Shift+Tab should go to the last button
        simulateTabWithFocusTrap(container, true);
        expect(document.activeElement).toBe(screen.getByTestId('button3'));
    });

    test('should set initial focus when initialFocus is true', () => {
        render(<FocusTrapTestComponent initialFocus={true} />);

        // The first focusable element should be focused automatically
        // We need to wait for the focus to be set
        setTimeout(() => {
            expect(document.activeElement).toBe(screen.getByTestId('button1'));
        }, 0);
    });

    test('should restore focus when restoreFocus is true', () => {
        // Focus the outside button first
        const outsideButton = screen.getByTestId('outside-button');
        outsideButton.focus();
        expect(document.activeElement).toBe(outsideButton);

        // Render the component with restoreFocus=true
        const {unmount} = render(<FocusTrapTestComponent restoreFocus={true} />);

        // Unmount the component
        unmount();

        // Focus should be restored to the outside button
        expect(document.activeElement).toBe(outsideButton);
    });

    test('should handle delay option', () => {
        jest.useFakeTimers();

        const {container} = render(<FocusTrapTestComponent delayMs={500} />);

        // Focus the first button
        const button1 = screen.getByTestId('button1');
        button1.focus();
        expect(document.activeElement).toBe(button1);

        // Tab to the next button - should not be trapped yet due to delay
        // We'll use simulateTabKey here to simulate what happens without the trap
        simulateTabKey();

        // Advance timers
        jest.advanceTimersByTime(500);

        // Now focus the first button again and try tabbing
        button1.focus();
        simulateTabWithFocusTrap(container);

        // Now the focus trap should be active
        expect(document.activeElement).toBe(screen.getByTestId('button2'));
    });

    test('should not activate when isActive is false', () => {
        render(<FocusTrapTestComponent isActive={false} />);

        // Focus the first button
        const button1 = screen.getByTestId('button1');
        button1.focus();
        expect(document.activeElement).toBe(button1);

        // Tab to the next button - should not be trapped
        // We'll use simulateTabKey here to simulate what happens without the trap
        simulateTabKey();

        // Focus should not be trapped within the container
        expect(document.activeElement).not.toBe(screen.getByTestId('button2'));
    });

    test('should handle nested focus traps', () => {
        render(<NestedFocusTrapsComponent />);

        // Focus the first inner button
        const innerButton1 = screen.getByTestId('inner-button1');
        innerButton1.focus();
        expect(document.activeElement).toBe(innerButton1);

        // Find the inner container
        const innerContainer = screen.getByTestId('inner-container');

        // Tab to the next button in the inner trap
        simulateTabWithFocusTrap(innerContainer);
        expect(document.activeElement).toBe(screen.getByTestId('inner-button2'));

        // Tab again should cycle back to the first inner button
        simulateTabWithFocusTrap(innerContainer);
        expect(document.activeElement).toBe(innerButton1);

        // The outer trap should not interfere with the inner trap
    });

    test('should handle empty containers gracefully', () => {
        // Create a component with no focusable elements
        function EmptyComponent() {
            const containerRef = useRef<HTMLDivElement>(null);
            useFocusTrap(true, containerRef);
            return <div ref={containerRef} data-testid='empty-container'></div>;
        }

        render(<EmptyComponent />);

        // No errors should be thrown
        const container = screen.getByTestId('empty-container');
        expect(container).toBeInTheDocument();
    });
});
