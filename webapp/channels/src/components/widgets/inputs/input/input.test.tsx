// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import Input from './input';

// Mock the WithTooltip component to avoid ref issues
jest.mock('components/with_tooltip', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => children,
}));

// Mock the CloseCircleIcon component to avoid ref issues
jest.mock('@mattermost/compass-icons/components', () => ({
    CloseCircleIcon: () => <div data-testid='close-circle-icon'/>,
}));

describe('components/widgets/inputs/Input', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <Input/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render with clearable enabled', async () => {
        const value = 'value';
        const clearableTooltipText = 'tooltip text';
        const onClear = jest.fn();

        renderWithContext(
            <Input
                value={value}
                clearable={true}
                clearableTooltipText={clearableTooltipText}
                onClear={onClear}
            />,
        );

        // Find the input with the value
        const inputElement = screen.getByDisplayValue(value);
        expect(inputElement).toBeInTheDocument();

        // Find the clear button's div container
        const iconElement = screen.getByTestId('close-circle-icon');
        expect(iconElement).toBeInTheDocument();

        // Click directly on the icon element
        await act(async () => {
            userEvent.click(iconElement);
        });

        // Verify onClear was called
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    describe('minLength validation', () => {
        test('should show error styling when input is empty with minLength set', () => {
            renderWithContext(
                <Input
                    value={''}
                    minLength={2}
                />,
            );

            // Check for error styling
            const fieldset = screen.getByRole('group');
            expect(fieldset).toHaveClass('Input_fieldset___error');

            // Check for error message
            const errorMessage = screen.getByText(/Must be at least 2 characters/i);
            expect(errorMessage).toBeInTheDocument();
        });

        test('should show error styling and message when input length < minLength', async () => {
            renderWithContext(
                <Input
                    value={'a'}
                    minLength={2}
                />,
            );

            // Find the input
            const inputElement = screen.getByDisplayValue('a');

            // Simulate change to trigger validation
            await act(async () => {
                // Clear the input first
                userEvent.clear(inputElement);

                // Then type the new value
                userEvent.type(inputElement, 'a');
            });

            // Check for error styling
            const fieldset = screen.getByRole('group');
            expect(fieldset).toHaveClass('Input_fieldset___error');

            // Check for error message
            const errorMessage = await screen.findByText(/Must be at least 2 characters/i);
            expect(errorMessage).toBeInTheDocument();
        });

        test('should not show error styling when input length >= minLength', async () => {
            const onChange = jest.fn();

            renderWithContext(
                <Input
                    value={'ab'}
                    minLength={2}
                    onChange={onChange}
                />,
            );

            // With exactly 2 characters and minLength of 2, there should be no error

            // Check that the +X indicator is not present
            expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();

            // Check that error message is not present
            expect(screen.queryByText(/Must be at least 2 characters/i)).not.toBeInTheDocument();
        });
    });

    describe('maxLength (limit) validation', () => {
        test('should show error styling when input length > limit', async () => {
            // Create a mock onChange function
            const onChange = jest.fn();

            // Render with a value that exceeds the limit
            renderWithContext(
                <Input
                    value={'abcdef'}
                    limit={5}
                    onChange={onChange}
                />,
            );

            // With 6 characters and limit of 5, there should be an error

            // Check for the -X indicator
            const indicator = screen.getByText('-1');
            expect(indicator).toBeInTheDocument();

            // Check for error styling
            const fieldset = screen.getByRole('group');
            expect(fieldset).toHaveClass('Input_fieldset___error');
        });

        test('should not show error styling when input length <= limit', async () => {
            const onChange = jest.fn();

            renderWithContext(
                <Input
                    value={'abcde'}
                    limit={5}
                    onChange={onChange}
                />,
            );

            // With exactly 5 characters and limit of 5, there should be no error
            // Check that the -X indicator is not present
            expect(screen.queryByText(/-\d+/)).not.toBeInTheDocument();

            // Check that error message is not present
            expect(screen.queryByText(/Must be no more than 5 characters/i)).not.toBeInTheDocument();
        });
    });

    describe('required field validation', () => {
        test('should not show error on empty required input until blur', async () => {
            renderWithContext(
                <Input
                    value={''}
                    required={true}
                />,
            );

            // Find the input
            const inputElement = screen.getByRole('textbox');

            // Check that error message is not present before blur
            expect(screen.queryByText(/This field is required/i)).not.toBeInTheDocument();

            // Simulate blur to trigger validation
            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            // Check for error message after blur
            const errorMessage = await screen.findByText(/This field is required/i);
            expect(errorMessage).toBeInTheDocument();

            // Check for error styling
            const fieldset = screen.getByRole('group');
            expect(fieldset).toHaveClass('Input_fieldset___error');
        });

        test('should not show error on non-empty required input', async () => {
            renderWithContext(
                <Input
                    value={'abc'}
                    required={true}
                />,
            );

            // Find the input
            const inputElement = screen.getByDisplayValue('abc');

            // Simulate blur to trigger validation
            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            // Check that error message is not present
            expect(screen.queryByText(/This field is required/i)).not.toBeInTheDocument();
        });
    });

    describe('interaction between validations', () => {
        test('should prioritize required validation over minLength on blur for empty input', async () => {
            renderWithContext(
                <Input
                    value={''}
                    required={true}
                    minLength={2}
                />,
            );

            // Find the input
            const inputElement = screen.getByRole('textbox');

            // Simulate blur to trigger validation
            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            // Check for required error message
            const errorMessage = await screen.findByText(/This field is required/i);
            expect(errorMessage).toBeInTheDocument();

            // Check that minLength error message is not present
            expect(screen.queryByText(/Must be at least 2 characters/i)).not.toBeInTheDocument();
        });

        test('should show both minLength indicator and limit indicator when applicable', () => {
            renderWithContext(
                <Input
                    value={'abc'}
                    minLength={5}
                    limit={10}
                    showMinLengthIndicator={true}
                />,
            );

            // Check for the +X indicator for minLength
            const indicator = screen.getByText('+2');
            expect(indicator).toBeInTheDocument();
        });
    });
});
