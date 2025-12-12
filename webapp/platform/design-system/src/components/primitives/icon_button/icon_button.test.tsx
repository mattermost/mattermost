// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import IconButton from './icon_button';
import type {IconButtonProps} from './icon_button';

// Mock icon component for testing
const TestIcon = ({testId = 'test-icon'}: {testId?: string}) => (
    <span data-testid={testId}>{'🔥'}</span>
);

// Re-enable WithTooltip mock when WithTooltip is available in platform design system
// jest.mock('components/with_tooltip', () => ({
//     __esModule: true,
//     default: ({children}: {children: React.ReactNode}) => children,
// }));

describe('components/primitives/icon_button/IconButton', () => {
    const baseProps: IconButtonProps = {
        icon: <TestIcon/>,
        'aria-label': 'Test button',
        title: 'Test tooltip',
    };

    // 1. RENDERING & PROPS TESTING
    describe('rendering', () => {
        test('should render with default props', () => {
            render(<IconButton {...baseProps}/>);

            const button = screen.getByRole('button', {name: 'Test button'});
            expect(button).toBeVisible();
            expect(button).toHaveClass('IconButton', 'IconButton--md');
            expect(button).not.toBeDisabled();
            expect(button).toHaveAttribute('aria-pressed', 'false');
        });

        test('should render all size variants', () => {
            const sizes: Array<IconButtonProps['size']> = ['xs', 'sm', 'md', 'lg'];

            sizes.forEach((size) => {
                const {unmount} = render(
                    <IconButton
                        {...baseProps}
                        size={size}
                        data-testid={`button-${size}`}
                    />,
                );

                expect(screen.getByTestId(`button-${size}`)).toHaveClass(`IconButton--${size}`);
                unmount();
            });
        });

        test('should render all padding variants', () => {
            const {rerender} = render(
                <IconButton
                    {...baseProps}
                    data-testid='padding-test'
                />,
            );

            expect(screen.getByTestId('padding-test')).not.toHaveClass('IconButton--compact');

            rerender(
                <IconButton
                    {...baseProps}
                    padding='compact'
                    data-testid='padding-test'
                />,
            );

            expect(screen.getByTestId('padding-test')).toHaveClass('IconButton--compact');
        });

        test('should render icon correctly', () => {
            render(<IconButton {...baseProps}/>);

            expect(screen.getByTestId('test-icon')).toBeInTheDocument();
            expect(screen.getByTestId('test-icon')).toBeVisible();
        });

        test('should apply custom className', () => {
            render(
                <IconButton
                    {...baseProps}
                    className='custom-class'
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveClass('IconButton', 'custom-class');
        });

        test('should handle different button types', () => {
            render(
                <IconButton
                    {...baseProps}
                    type='submit'
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('type', 'submit');
        });
    });

    // 2. ACCESSIBILITY TESTING
    describe('accessibility', () => {
        test('should have proper ARIA attributes', () => {
            render(<IconButton {...baseProps}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Test button');
            expect(button).toHaveAttribute('aria-pressed', 'false');
        });

        test('should set aria-pressed for toggled state', () => {
            render(
                <IconButton
                    {...baseProps}
                    toggled={true}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-pressed', 'true');
        });

        test('should be focusable and have proper focus management', async () => {
            const user = userEvent.setup();
            render(<IconButton {...baseProps}/>);

            const button = screen.getByRole('button');
            await user.tab();

            expect(button).toHaveFocus();
        });

        test('should not be focusable when disabled', () => {
            render(
                <IconButton
                    {...baseProps}
                    disabled={true}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toBeDisabled();
        });

        test('should maintain accessibility with loading state', () => {
            render(
                <IconButton
                    {...baseProps}
                    loading={true}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toBeDisabled();
            expect(button).toHaveAttribute('aria-label', 'Test button');
        });
    });

    // 3. USER INTERACTIONS
    describe('interactions', () => {
        test('should call onClick when clicked', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            render(
                <IconButton
                    {...baseProps}
                    onClick={handleClick}
                />,
            );

            await user.click(screen.getByRole('button'));
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        test('should not call onClick when disabled', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            render(
                <IconButton
                    {...baseProps}
                    disabled={true}
                    onClick={handleClick}
                />,
            );

            await user.click(screen.getByRole('button'));
            expect(handleClick).not.toHaveBeenCalled();
        });

        test('should not call onClick when loading', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            render(
                <IconButton
                    {...baseProps}
                    loading={true}
                    onClick={handleClick}
                />,
            );

            await user.click(screen.getByRole('button'));
            expect(handleClick).not.toHaveBeenCalled();
        });

        test('should respond to keyboard events', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            render(
                <IconButton
                    {...baseProps}
                    onClick={handleClick}
                />,
            );

            const button = screen.getByRole('button');
            button.focus();
            await user.keyboard('[Enter]');

            expect(handleClick).toHaveBeenCalledTimes(1);
        });
    });

    // 4. STATE & CONDITIONAL RENDERING
    describe('states', () => {
        test('should render loading state correctly', () => {
            render(
                <IconButton
                    {...baseProps}
                    loading={true}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveClass('IconButton--loading');
            expect(button).toBeDisabled();

            // Icon should be hidden when loading
            expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument();

            // Spinner should be visible
            expect(screen.getByRole('status')).toBeInTheDocument();
        });

        test('should render toggled state correctly', () => {
            render(
                <IconButton
                    {...baseProps}
                    toggled={true}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveClass('IconButton--toggled');
            expect(button).toHaveAttribute('aria-pressed', 'true');
        });

        test('should render destructive state correctly', () => {
            render(
                <IconButton
                    {...baseProps}
                    destructive={true}
                />,
            );

            expect(screen.getByRole('button')).toHaveClass('IconButton--destructive');
        });

        test('should render inverted state correctly', () => {
            render(
                <IconButton
                    {...baseProps}
                    inverted={true}
                />,
            );

            expect(screen.getByRole('button')).toHaveClass('IconButton--inverted');
        });

        test('should render rounded state correctly', () => {
            render(
                <IconButton
                    {...baseProps}
                    rounded={true}
                />,
            );

            expect(screen.getByRole('button')).toHaveClass('IconButton--rounded');
        });

        test('should combine multiple state classes', () => {
            render(
                <IconButton
                    {...baseProps}
                    size='lg'
                    toggled={true}
                    destructive={true}
                    inverted={true}
                    rounded={true}
                    padding='compact'
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveClass(
                'IconButton',
                'IconButton--lg',
                'IconButton--toggled',
                'IconButton--destructive',
                'IconButton--inverted',
                'IconButton--rounded',
                'IconButton--compact',
            );
        });
    });

    // 5. COUNT FEATURE
    describe('count feature', () => {
        test('should render count when enabled with count number', () => {
            render(
                <IconButton
                    {...baseProps}
                    showCount={true}
                    count={5}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveClass('IconButton--with-count');
            expect(button).toHaveTextContent('5');
        });

        test('should not render count when disabled', () => {
            render(
                <IconButton
                    {...baseProps}
                    count={5}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).not.toHaveClass('IconButton--with-count');
            expect(button).not.toHaveTextContent('5');
        });

        test('should format count correctly', () => {
            const {rerender} = render(
                <IconButton
                    {...baseProps}
                    showCount={true}
                    count={42}
                />,
            );

            const countElement = screen.getByRole('button').querySelector('.IconButton__count');
            expect(countElement).toHaveTextContent('42');

            rerender(
                <IconButton
                    {...baseProps}
                    showCount={true}
                    count={99}
                />,
            );
            const countElement2 = screen.getByRole('button').querySelector('.IconButton__count');
            expect(countElement2).toHaveTextContent('99');
        });

        test('should display large count numbers', () => {
            render(
                <IconButton
                    {...baseProps}
                    showCount={true}
                    count={12345}
                />,
            );

            const countElement = screen.getByRole('button').querySelector('.IconButton__count');
            expect(countElement).toHaveTextContent('12345');
        });

        test('should handle zero count', () => {
            render(
                <IconButton
                    {...baseProps}
                    showCount={true}
                    count={0}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveClass('IconButton--with-count');
            expect(button.querySelector('.IconButton__count')).toHaveTextContent('0');
        });

        test('should hide count when loading', () => {
            render(
                <IconButton
                    {...baseProps}
                    showCount={true}
                    count={5}
                    loading={true}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).not.toHaveTextContent('5');
            expect(button.querySelector('.IconButton__count')).not.toBeInTheDocument();
        });
    });

    // 6. UNREAD INDICATOR
    describe('unread indicator', () => {
        test('should render unread indicator when enabled', () => {
            render(
                <IconButton
                    {...baseProps}
                    unread={true}
                />,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveClass('IconButton--with-unread');
            expect(button.querySelector('.IconButton__unread-indicator')).toBeInTheDocument();
        });

        test('should not render unread indicator when disabled', () => {
            render(<IconButton {...baseProps}/>);

            const button = screen.getByRole('button');
            expect(button).not.toHaveClass('IconButton--with-unread');
            expect(button.querySelector('.IconButton__unread-indicator')).not.toBeInTheDocument();
        });

        test('should apply correct size classes to indicator', () => {
            render(
                <IconButton
                    {...baseProps}
                    size='lg'
                    unread={true}
                />,
            );

            const indicator = screen.getByRole('button').querySelector('.IconButton__unread-indicator');
            expect(indicator).toHaveClass('IconButton__unread-indicator--lg');
        });
    });

    // 7. REF FORWARDING
    describe('ref forwarding', () => {
        test('should forward ref to button element', () => {
            const ref = React.createRef<HTMLButtonElement>();

            render(
                <IconButton
                    {...baseProps}
                    ref={ref}
                />,
            );

            expect(ref.current).toBeInstanceOf(HTMLButtonElement);
            expect(ref.current).toBe(screen.getByRole('button'));
        });

        test('should allow calling focus on ref', () => {
            const ref = React.createRef<HTMLButtonElement>();

            render(
                <IconButton
                    {...baseProps}
                    ref={ref}
                />,
            );

            ref.current?.focus();
            expect(ref.current).toHaveFocus();
        });

        test('should allow DOM method calls on ref', () => {
            const ref = React.createRef<HTMLButtonElement>();
            const handleClick = jest.fn();

            render(
                <IconButton
                    {...baseProps}
                    ref={ref}
                    onClick={handleClick}
                />,
            );

            expect(() => {
                ref.current?.focus();
                ref.current?.blur();
                ref.current?.click();
            }).not.toThrow();

            expect(handleClick).toHaveBeenCalledTimes(1);
        });
    });

    // 8. INTEGRATION & PERFORMANCE TESTS
    describe('integration and performance', () => {
        test('should work in forms', async () => {
            const user = userEvent.setup();
            const handleSubmit = jest.fn((e) => e.preventDefault());

            render(
                <form onSubmit={handleSubmit}>
                    <IconButton
                        {...baseProps}
                        type='submit'
                    />
                </form>,
            );

            await user.click(screen.getByRole('button'));
            expect(handleSubmit).toHaveBeenCalledTimes(1);
        });

        test('should work with custom HTML attributes', () => {
            render(
                <IconButton
                    {...baseProps}
                    data-testid='custom-button'
                    aria-describedby='help-text'
                />,
            );

            const button = screen.getByTestId('custom-button');
            expect(button).toHaveAttribute('aria-describedby', 'help-text');
            expect(button).toHaveAttribute('data-testid', 'custom-button');
        });

        test('should not re-render unnecessarily with memo', () => {
            const renderSpy = jest.fn();
            const TestIconButton = React.memo(() => {
                renderSpy();
                return <IconButton {...baseProps}/>;
            });

            const {rerender} = render(<TestIconButton/>);
            rerender(<TestIconButton/>);

            expect(renderSpy).toHaveBeenCalledTimes(1);
        });

        test('should handle rapid state changes', async () => {
            const user = userEvent.setup();

            const TestComponent = () => {
                const [isLoading, setIsLoading] = React.useState(false);
                return (
                    <IconButton
                        {...baseProps}
                        loading={isLoading}
                        onClick={() => setIsLoading(!isLoading)}
                    />
                );
            };

            render(<TestComponent/>);

            const button = screen.getByRole('button');

            // Rapid clicks to test state changes
            await user.click(button);
            expect(button).toBeDisabled();

            await user.click(button); // Should not respond when loading
            expect(button).toBeDisabled();
        });

        test('should handle edge cases gracefully', () => {
            // Test with null count
            expect(() => {
                render(
                    <IconButton
                        {...baseProps}
                        showCount={true}
                        count={null as unknown as number}
                    />,
                );
            }).not.toThrow();

            // Test with undefined icon (should still render)
            expect(() => {
                render(
                    <IconButton
                        icon={undefined as unknown as React.ReactNode}
                        aria-label='Test'
                        title='Test'
                    />,
                );
            }).not.toThrow();
        });
    });

    // 10. COMPONENT METADATA
    describe('component metadata', () => {
        test('should have correct displayName', () => {
            // The component is exported as a memo wrapper, but displayName should be preserved
            expect(IconButton.displayName).toBe('IconButton');
        });
    });
});
