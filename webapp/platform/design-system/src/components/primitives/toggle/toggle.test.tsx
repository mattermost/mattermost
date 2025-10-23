// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';

import {Toggle} from './toggle';

describe('Toggle', () => {
    const mockOnToggle = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const baseProps = {
        onToggle: mockOnToggle,
    };

    describe('rendering', () => {
        test('should render toggle button', () => {
            render(<Toggle {...baseProps}/>);

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();
        });

        test('should render with default size btn-lg', () => {
            render(<Toggle {...baseProps}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('btn-lg');
        });

        test('should render with custom size', () => {
            render(<Toggle {...baseProps} size='btn-sm'/>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('btn-sm');
        });

        test('should render with custom toggle class name', () => {
            render(<Toggle {...baseProps} toggleClassName='custom-toggle'/>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('custom-toggle');
        });

        test('should render with id attribute', () => {
            render(<Toggle {...baseProps} id='test-toggle'/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('id', 'test-toggle');
        });

        test('should render handle element', () => {
            const {container} = render(<Toggle {...baseProps}/>);

            const handle = container.querySelector('.handle');
            expect(handle).toBeInTheDocument();
        });
    });

    describe('toggle states', () => {
        test('should render with toggled false by default', () => {
            render(<Toggle {...baseProps}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-pressed', 'false');
            expect(button).not.toHaveClass('active');
        });

        test('should render with toggled true', () => {
            render(<Toggle {...baseProps} toggled={true}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-pressed', 'true');
            expect(button).toHaveClass('active');
        });

        test('should render with toggled false', () => {
            render(<Toggle {...baseProps} toggled={false}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-pressed', 'false');
            expect(button).not.toHaveClass('active');
        });
    });

    describe('text labels', () => {
        test('should render on text when toggled', () => {
            render(
                <Toggle
                    {...baseProps}
                    toggled={true}
                    onText='Enabled'
                />,
            );

            expect(screen.getByText('Enabled')).toBeInTheDocument();
        });

        test('should render off text when not toggled', () => {
            render(
                <Toggle
                    {...baseProps}
                    toggled={false}
                    offText='Disabled'
                />,
            );

            expect(screen.getByText('Disabled')).toBeInTheDocument();
        });

        test('should render on text and hide off text when toggled', () => {
            render(
                <Toggle
                    {...baseProps}
                    toggled={true}
                    onText='On'
                    offText='Off'
                />,
            );

            expect(screen.getByText('On')).toBeInTheDocument();
            expect(screen.queryByText('Off')).not.toBeInTheDocument();
        });

        test('should render off text and hide on text when not toggled', () => {
            render(
                <Toggle
                    {...baseProps}
                    toggled={false}
                    onText='On'
                    offText='Off'
                />,
            );

            expect(screen.getByText('Off')).toBeInTheDocument();
            expect(screen.queryByText('On')).not.toBeInTheDocument();
        });

        test('should not render text container when toggled but no onText provided', () => {
            const {container} = render(
                <Toggle
                    {...baseProps}
                    toggled={true}
                />,
            );

            const textElement = container.querySelector('.bg-text');
            expect(textElement).not.toBeInTheDocument();
        });

        test('should not render text container when not toggled but no offText provided', () => {
            const {container} = render(
                <Toggle
                    {...baseProps}
                    toggled={false}
                />,
            );

            const textElement = container.querySelector('.bg-text');
            expect(textElement).not.toBeInTheDocument();
        });

        test('should render text container with on class when toggled', () => {
            const {container} = render(
                <Toggle
                    {...baseProps}
                    toggled={true}
                    onText='On'
                />,
            );

            const textElement = container.querySelector('.bg-text');
            expect(textElement).toHaveClass('on');
        });

        test('should render text container with off class when not toggled', () => {
            const {container} = render(
                <Toggle
                    {...baseProps}
                    toggled={false}
                    offText='Off'
                />,
            );

            const textElement = container.querySelector('.bg-text');
            expect(textElement).toHaveClass('off');
        });
    });

    describe('disabled state', () => {
        test('should render as disabled', () => {
            render(<Toggle {...baseProps} disabled={true}/>);

            const button = screen.getByRole('button');
            expect(button).toBeDisabled();
            expect(button).toHaveClass('disabled');
        });

        test('should not call onToggle when disabled and clicked', () => {
            render(<Toggle {...baseProps} disabled={true}/>);

            const button = screen.getByRole('button');
            fireEvent.click(button);

            expect(mockOnToggle).not.toHaveBeenCalled();
        });
    });

    describe('interactions', () => {
        test('should call onToggle when clicked', () => {
            render(<Toggle {...baseProps}/>);

            const button = screen.getByRole('button');
            fireEvent.click(button);

            expect(mockOnToggle).toHaveBeenCalledTimes(1);
        });

        test('should call onToggle multiple times', () => {
            render(<Toggle {...baseProps}/>);

            const button = screen.getByRole('button');
            fireEvent.click(button);
            fireEvent.click(button);
            fireEvent.click(button);

            expect(mockOnToggle).toHaveBeenCalledTimes(3);
        });
    });

    describe('accessibility', () => {
        test('should have aria-label when provided', () => {
            render(<Toggle {...baseProps} ariaLabel='Toggle feature'/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Toggle feature');
        });

        test('should have default tabIndex of 0', () => {
            render(<Toggle {...baseProps}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('tabIndex', '0');
        });

        test('should have custom tabIndex when provided', () => {
            render(<Toggle {...baseProps} tabIndex={-1}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('tabIndex', '-1');
        });

        test('should have button type', () => {
            render(<Toggle {...baseProps}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('type', 'button');
        });

        test('should have aria-pressed attribute', () => {
            render(<Toggle {...baseProps}/>);

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-pressed');
        });
    });

    describe('data-testid', () => {
        test('should generate data-testid from id', () => {
            render(<Toggle {...baseProps} id='my-toggle'/>);

            const button = screen.getByTestId('my-toggle-button');
            expect(button).toBeInTheDocument();
        });

        test('should use id as data-testid when overrideTestId is true', () => {
            render(<Toggle {...baseProps} id='my-toggle' overrideTestId={true}/>);

            const button = screen.getByTestId('my-toggle');
            expect(button).toBeInTheDocument();
        });

        test('should have empty data-testid when overrideTestId is true and no id provided', () => {
            const {container} = render(<Toggle {...baseProps} overrideTestId={true}/>);

            const button = container.querySelector('button');
            expect(button).toHaveAttribute('data-testid', '');
        });
    });
});
