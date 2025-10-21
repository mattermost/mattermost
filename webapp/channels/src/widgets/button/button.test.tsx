// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Button from './button';
import type {ButtonProps} from './button';

// Mock icon component for testing
const TestIcon = ({testId = 'test-icon'}: {testId?: string}) => (
    <span data-testid={testId}>🔥</span>
);

describe('components/widgets/button/Button', () => {
    const baseProps: ButtonProps = {
        children: 'Test Button',
    };

    // 1. RENDERING & PROPS TESTING
    describe('rendering', () => {
        test('should render with default props', () => {
            renderWithContext(<Button {...baseProps}/>);

            const button = screen.getByRole('button', {name: 'Test Button'});
            expect(button).toBeVisible();
            expect(button).toHaveClass('Button', 'Button--md', 'Button--primary');
            expect(button).not.toBeDisabled();
            expect(button).toHaveAttribute('aria-busy', 'false');
        });

        test('should render all size variants', () => {
            const sizes: ButtonProps['size'][] = ['xs', 'sm', 'md', 'lg'];

            sizes.forEach((size) => {
                const {unmount} = renderWithContext(
                    <Button {...baseProps} size={size} data-testid={`button-${size}`}/>,
                );

                expect(screen.getByTestId(`button-${size}`)).toHaveClass(`Button--${size}`);
                unmount();
            });
        });

        test('should render all emphasis variants', () => {
            const emphases: ButtonProps['emphasis'][] = ['primary', 'secondary', 'tertiary', 'quaternary', 'link'];

            emphases.forEach((emphasis) => {
                const {unmount} = renderWithContext(
                    <Button {...baseProps} emphasis={emphasis} data-testid={`button-${emphasis}`}/>,
                );

                expect(screen.getByTestId(`button-${emphasis}`)).toHaveClass(`Button--${emphasis}`);
                unmount();
            });
        });

        test('should render without children', () => {
            renderWithContext(<Button data-testid='no-children'/>);

            const button = screen.getByTestId('no-children');
            expect(button).toBeInTheDocument();
            expect(button).toHaveClass('Button');
        });

        test('should apply custom className', () => {
            renderWithContext(<Button className='custom-class'>Custom</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('Button', 'custom-class');
        });
    });

    // 2. ACCESSIBILITY TESTING
    describe('accessibility', () => {
        test('should have proper ARIA attributes when loading', () => {
            renderWithContext(<Button loading>Loading Button</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-busy', 'true');

            const loadingStatus = screen.getByRole('status');
            expect(loadingStatus).toHaveAttribute('aria-label', 'Loading');

            const spinner = loadingStatus.querySelector('span[aria-hidden="true"]');
            expect(spinner).toBeInTheDocument();
        });

        test('should be focusable and have proper focus management', async () => {
            const user = userEvent.setup();
            renderWithContext(<Button>Focus Test</Button>);

            const button = screen.getByRole('button');
            await user.tab();

            expect(button).toHaveFocus();
        });

        test('should not be focusable when disabled', () => {
            renderWithContext(<Button disabled>Disabled Button</Button>);

            const button = screen.getByRole('button');
            expect(button).toBeDisabled();
            expect(button).toHaveAttribute('aria-busy', 'false');
        });

        test('should announce loading state to screen readers', () => {
            renderWithContext(<Button loading>Save</Button>);

            expect(screen.getByRole('status')).toBeInTheDocument();
            expect(screen.getByLabelText('Loading')).toBeInTheDocument();
        });

        test('should maintain accessibility with all variants', () => {
            renderWithContext(
                <Button
                    size='lg'
                    emphasis='secondary'
                    destructive
                    loading
                >
                    Accessible Button
                </Button>,
            );

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();
            expect(button).toHaveAttribute('aria-busy', 'true');
            expect(screen.getByRole('status')).toBeInTheDocument();
        });
    });

    // 3. USER INTERACTIONS
    describe('interactions', () => {
        test('should call onClick when clicked', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            renderWithContext(<Button onClick={handleClick}>Click Me</Button>);

            await user.click(screen.getByRole('button'));
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        test('should not call onClick when disabled', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            renderWithContext(
                <Button disabled onClick={handleClick}>
                    Disabled
                </Button>,
            );

            await user.click(screen.getByRole('button'));
            expect(handleClick).not.toHaveBeenCalled();
        });

        test('should not call onClick when loading', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            renderWithContext(
                <Button loading onClick={handleClick}>
                    Loading
                </Button>,
            );

            await user.click(screen.getByRole('button'));
            expect(handleClick).not.toHaveBeenCalled();
        });

        test('should respond to keyboard events', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            renderWithContext(<Button onClick={handleClick}>Keyboard Test</Button>);

            const button = screen.getByRole('button');
            button.focus();
            await user.keyboard('[Enter]');

            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        test('should respond to space key', async () => {
            const user = userEvent.setup();
            const handleClick = jest.fn();

            renderWithContext(<Button onClick={handleClick}>Space Test</Button>);

            const button = screen.getByRole('button');
            button.focus();
            await user.keyboard('[Space]');

            expect(handleClick).toHaveBeenCalledTimes(1);
        });
    });

    // 4. STATE & CONDITIONAL RENDERING
    describe('states', () => {
        test('should render loading state correctly', () => {
            renderWithContext(<Button loading>Loading Button</Button>);

            expect(screen.getByRole('status')).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveClass('Button--loading');
        });

        test('should render destructive state correctly', () => {
            renderWithContext(<Button destructive>Delete</Button>);

            expect(screen.getByRole('button')).toHaveClass('Button--destructive');
        });

        test('should render inverted state correctly', () => {
            renderWithContext(<Button inverted>Inverted</Button>);

            expect(screen.getByRole('button')).toHaveClass('Button--inverted');
        });

        test('should handle fullWidth prop', () => {
            renderWithContext(<Button fullWidth>Full Width</Button>);

            expect(screen.getByRole('button')).toHaveClass('Button--full-width');
        });

        test('should apply custom width styles', () => {
            renderWithContext(<Button width='200px'>Custom Width</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('Button--fixed-width');
            expect(button).toHaveStyle('width: 200px');
        });

        test('should combine multiple state classes', () => {
            renderWithContext(
                <Button
                    size='lg'
                    emphasis='secondary'
                    destructive
                    inverted
                    fullWidth
                >
                    Multiple States
                </Button>,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveClass(
                'Button',
                'Button--lg',
                'Button--secondary',
                'Button--destructive',
                'Button--inverted',
                'Button--full-width',
            );
        });

        test('should handle disabled and loading states together', () => {
            renderWithContext(
                <Button disabled loading>
                    Disabled Loading
                </Button>,
            );

            const button = screen.getByRole('button');
            expect(button).toBeDisabled();
            expect(button).toHaveClass('Button--loading');
            expect(button).toHaveAttribute('aria-busy', 'true');
        });
    });

    // 5. ICON HANDLING
    describe('icons', () => {
        test('should render icon before text', () => {
            renderWithContext(
                <Button iconBefore={<TestIcon/>}>
                    With Icon Before
                </Button>,
            );

            expect(screen.getByTestId('test-icon')).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveTextContent('With Icon Before');
        });

        test('should render icon after text', () => {
            renderWithContext(
                <Button iconAfter={<TestIcon/>}>
                    With Icon After
                </Button>,
            );

            expect(screen.getByTestId('test-icon')).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveTextContent('With Icon After');
        });

        test('should render both icons before and after', () => {
            renderWithContext(
                <Button
                    iconBefore={<TestIcon testId='icon-before'/>}
                    iconAfter={<TestIcon testId='icon-after'/>}
                >
                    Both Icons
                </Button>,
            );

            expect(screen.getByTestId('icon-before')).toBeInTheDocument();
            expect(screen.getByTestId('icon-after')).toBeInTheDocument();
        });

        test('should hide icons when loading', () => {
            renderWithContext(
                <Button
                    loading
                    iconBefore={<TestIcon testId='icon-before'/>}
                    iconAfter={<TestIcon testId='icon-after'/>}
                >
                    Loading
                </Button>,
            );

            expect(screen.queryByTestId('icon-before')).not.toBeInTheDocument();
            expect(screen.queryByTestId('icon-after')).not.toBeInTheDocument();
            expect(screen.getByRole('status')).toBeInTheDocument();
        });

        test('should apply correct icon classes based on size', () => {
            renderWithContext(
                <Button size='lg' iconBefore={<TestIcon/>}>
                    Large Icon
                </Button>,
            );

            const iconContainer = screen.getByTestId('test-icon').parentElement;
            expect(iconContainer).toHaveClass('Button__icon', 'Button__icon--lg', 'Button__icon--before');
        });
    });

    // 6. REF FORWARDING
    describe('ref forwarding', () => {
        test('should forward ref to button element', () => {
            const ref = React.createRef<HTMLButtonElement>();

            renderWithContext(<Button ref={ref}>Ref Test</Button>);

            expect(ref.current).toBeInstanceOf(HTMLButtonElement);
            expect(ref.current).toBe(screen.getByRole('button'));
        });

        test('should allow calling focus on ref', () => {
            const ref = React.createRef<HTMLButtonElement>();

            renderWithContext(<Button ref={ref}>Focus via Ref</Button>);

            ref.current?.focus();
            expect(ref.current).toHaveFocus();
        });

        test('should allow DOM method calls on ref', () => {
            const ref = React.createRef<HTMLButtonElement>();
            const handleClick = jest.fn();

            renderWithContext(
                <Button ref={ref} onClick={handleClick}>
                    DOM Methods
                </Button>,
            );

            expect(() => {
                ref.current?.focus();
                ref.current?.blur();
                ref.current?.click();
            }).not.toThrow();

            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        test('should maintain ref through re-renders', () => {
            const ref = React.createRef<HTMLButtonElement>();

            const {rerender} = renderWithContext(
                <Button ref={ref}>Version 1</Button>,
            );

            const firstElement = ref.current;

            rerender(<Button ref={ref}>Version 2</Button>);

            expect(ref.current).toBe(firstElement);
            expect(ref.current).toHaveTextContent('Version 2');
        });
    });

    // 7. SNAPSHOT TESTS
    describe('snapshots', () => {
        test('should match snapshot with default props', () => {
            const {container} = renderWithContext(<Button>Default</Button>);
            expect(container.firstChild).toMatchSnapshot();
        });

        test('should match snapshot with all size variants', () => {
            const sizes: ButtonProps['size'][] = ['xs', 'sm', 'md', 'lg'];

            sizes.forEach((size) => {
                const {container} = renderWithContext(<Button size={size}>Size {size}</Button>);
                expect(container.firstChild).toMatchSnapshot(`Button size ${size}`);
            });
        });

        test('should match snapshot with all emphasis variants', () => {
            const emphases: ButtonProps['emphasis'][] = ['primary', 'secondary', 'tertiary', 'quaternary', 'link'];

            emphases.forEach((emphasis) => {
                const {container} = renderWithContext(
                    <Button emphasis={emphasis}>
                        Emphasis {emphasis}
                    </Button>,
                );
                expect(container.firstChild).toMatchSnapshot(`Button emphasis ${emphasis}`);
            });
        });

        test('should match snapshot with all props', () => {
            const {container} = renderWithContext(
                <Button
                    size='lg'
                    emphasis='secondary'
                    destructive
                    inverted
                    loading
                    fullWidth
                    width='300px'
                    className='custom-class'
                    iconBefore={<TestIcon/>}
                >
                    All Props
                </Button>,
            );
            expect(container.firstChild).toMatchSnapshot();
        });

        test('should match snapshot in disabled state', () => {
            const {container} = renderWithContext(
                <Button disabled destructive>
                    Disabled Destructive
                </Button>,
            );
            expect(container.firstChild).toMatchSnapshot();
        });
    });

    // 8. INTEGRATION TESTS
    describe('integration', () => {
        test('should work in forms', async () => {
            const user = userEvent.setup();
            const handleSubmit = jest.fn((e) => e.preventDefault());

            renderWithContext(
                <form onSubmit={handleSubmit}>
                    <Button type='submit'>Submit Form</Button>
                </form>,
            );

            await user.click(screen.getByRole('button'));
            expect(handleSubmit).toHaveBeenCalledTimes(1);
        });

        test('should work with custom HTML attributes', () => {
            renderWithContext(
                <Button
                    data-testid='custom-button'
                    aria-describedby='help-text'
                    title='Custom title'
                >
                    Custom Attributes
                </Button>,
            );

            const button = screen.getByTestId('custom-button');
            expect(button).toHaveAttribute('aria-describedby', 'help-text');
            expect(button).toHaveAttribute('title', 'Custom title');
        });

        test('should handle form validation attributes', () => {
            renderWithContext(
                <Button
                    type='submit'
                    form='my-form'
                    formNoValidate
                >
                    Submit Without Validation
                </Button>,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('type', 'submit');
            expect(button).toHaveAttribute('form', 'my-form');
            expect(button).toHaveAttribute('formNoValidate');
        });

        test('should merge custom styles with width prop', () => {
            renderWithContext(
                <Button
                    width='250px'
                    style={{backgroundColor: 'red', margin: '10px'}}
                >
                    Custom Styles
                </Button>,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveStyle({
                width: '250px',
                backgroundColor: 'red',
                margin: '10px',
            });
        });
    });

    // 9. PERFORMANCE & EDGE CASES
    describe('performance and edge cases', () => {
        test('should not re-render unnecessarily with memo', () => {
            const renderSpy = jest.fn();
            const TestButton = React.memo(() => {
                renderSpy();
                return <Button>Memo Test</Button>;
            });

            const {rerender} = renderWithContext(<TestButton/>);
            rerender(<TestButton/>);

            expect(renderSpy).toHaveBeenCalledTimes(1);
        });

        test('should handle empty string children', () => {
            renderWithContext(<Button>{''}</Button>);

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();
            expect(button).toBeEmptyDOMElement();
        });

        test('should handle null children gracefully', () => {
            renderWithContext(<Button>{null}</Button>);

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();
        });

        test('should handle zero as children', () => {
            renderWithContext(<Button>{0}</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveTextContent('0');
        });

        test('should handle complex children structures', () => {
            renderWithContext(
                <Button>
                    <span>Complex</span>
                    {' '}
                    <strong>Children</strong>
                </Button>,
            );

            const button = screen.getByRole('button');
            expect(button).toHaveTextContent('Complex Children');
            expect(button.querySelector('span')).toBeInTheDocument();
            expect(button.querySelector('strong')).toBeInTheDocument();
        });

        test('should handle rapid state changes', async () => {
            const user = userEvent.setup();
            let loading = false;
            const toggleLoading = () => {
                loading = !loading;
            };

            const TestComponent = () => {
                const [isLoading, setIsLoading] = React.useState(false);
                return (
                    <div>
                        <Button
                            loading={isLoading}
                            onClick={() => setIsLoading(!isLoading)}
                        >
                            Toggle Loading
                        </Button>
                    </div>
                );
            };

            renderWithContext(<TestComponent/>);

            const button = screen.getByRole('button');

            // Rapid clicks to test state changes
            await user.click(button);
            expect(button).toHaveAttribute('aria-busy', 'true');

            await user.click(button); // Should not respond when loading
            expect(button).toHaveAttribute('aria-busy', 'true');
        });
    });

    // COMPONENT DISPLAY NAME
    describe('component metadata', () => {
        test('should have correct displayName', () => {
            expect(Button.displayName).toBe('Button');
        });
    });
});
