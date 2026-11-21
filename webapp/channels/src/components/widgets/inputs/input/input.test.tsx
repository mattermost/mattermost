// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Input from './input';

describe('components/widgets/inputs/Input', () => {
    test('should keep defaultValue across re-renders when value is omitted (uncontrolled / IME)', () => {
        const {rerender} = renderWithContext(
            <Input
                defaultValue=''
                testId='fixture.input'
            />,
        );
        const input = screen.getByRole('textbox') as HTMLInputElement;

        fireEvent.input(input, {target: {value: '그'}});
        rerender(
            <Input
                defaultValue=''
                testId='fixture.input'
            />,
        );

        expect(input.value).toBe('그');
    });

    test('should render with clearable enabled', async () => {
        const value = 'value';
        const clearableTooltipText = 'tooltip text';
        const onClear = jest.fn();

        renderWithContext(
            <Input
                testId='fixture.input'
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
        const iconElement = document.querySelector('.Input__clear');
        expect(iconElement).toBeInTheDocument();

        // Click directly on the icon element
        await userEvent.click(iconElement!);

        // Verify onClear was called
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    describe('customMessage prop', () => {
        const TestInput = () => {
            const [value, setValue] = React.useState('');
            return (
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    customMessage={{type: 'info', value: 'Helper text'}}
                />
            );
        };

        test('should render the custom message', () => {
            renderWithContext(<TestInput/>);

            expect(screen.getByText('Helper text')).toBeInTheDocument();
        });

        test('should not unmount the custom message while typing', async () => {
            renderWithContext(<TestInput/>);
            const container = document.querySelector('.Input_container')!;
            const records: MutationRecord[] = [];
            const observer = new MutationObserver((mutations) => records.push(...mutations));
            observer.observe(container, {childList: true, subtree: true});

            await userEvent.type(screen.getByRole('textbox'), 'abc');

            records.push(...observer.takeRecords());
            const removedMessages = records.flatMap((record) => Array.from(record.removedNodes)).filter((node) => (node as Element).classList?.contains('Input___customMessage'));
            observer.disconnect();

            expect(removedMessages).toHaveLength(0);
            expect(screen.getByText('Helper text')).toBeInTheDocument();
        });

        test('should remove the custom message when the prop is cleared', () => {
            const {rerender} = renderWithContext(
                <Input customMessage={{type: 'error', value: 'Bad value'}}/>,
            );
            expect(screen.getByText('Bad value')).toBeInTheDocument();

            rerender(<Input customMessage={null}/>);

            expect(screen.queryByText('Bad value')).not.toBeInTheDocument();
        });

        test('should show a parent error instead of a local required error', async () => {
            const {rerender} = renderWithContext(
                <Input
                    value=''
                    required={true}
                />,
            );
            const input = screen.getByRole('textbox');

            await act(async () => {
                input.focus();
                input.blur();
            });
            expect(await screen.findByText(/This field is required/i)).toBeInTheDocument();

            rerender(
                <Input
                    value=''
                    required={true}
                    customMessage={{type: 'error', value: 'Name already taken'}}
                />,
            );

            expect(screen.getByText('Name already taken')).toBeInTheDocument();
            expect(screen.queryByText(/This field is required/i)).not.toBeInTheDocument();
        });

        test('should show a local error instead of parent info text', async () => {
            renderWithContext(
                <Input
                    value=''
                    required={true}
                    customMessage={{type: 'info', value: 'Helper text'}}
                />,
            );
            const input = screen.getByRole('textbox');

            await act(async () => {
                input.focus();
                input.blur();
            });

            expect(await screen.findByText(/This field is required/i)).toBeInTheDocument();
            expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
        });

        test('should still clear validation errors when typing', async () => {
            renderWithContext(
                <Input
                    value=''
                    required={true}
                    customMessage={{type: 'info', value: 'Helper text'}}
                />,
            );
            const input = screen.getByRole('textbox');

            await act(async () => {
                input.focus();
                input.blur();
            });
            expect(await screen.findByText(/This field is required/i)).toBeInTheDocument();

            await userEvent.type(input, 'a');

            expect(screen.queryByText(/This field is required/i)).not.toBeInTheDocument();
            expect(screen.getByText('Helper text')).toBeInTheDocument();
        });
    });

    describe('handleOnBlur functionality', () => {
        test('should validate immediately when blur occurs without relatedTarget', async () => {
            const mockValidate = jest.fn();
            const mockOnBlur = jest.fn();

            const {container} = renderWithContext(
                <Input
                    testId='fixture.input'
                    name='test'
                    value=''
                    validate={mockValidate}
                    onBlur={mockOnBlur}
                />,
            );

            const input = container.querySelector('input') as HTMLInputElement;

            // Trigger validation on blur - fireEvent used because userEvent doesn't have direct focus/blur methods
            await act(async () => {
                fireEvent.focus(input);
                fireEvent.blur(input);
            });

            expect(mockValidate).toHaveBeenCalledTimes(1);
            expect(mockOnBlur).toHaveBeenCalledTimes(1);
        });

        test('should defer validation when relatedTarget has click method', async () => {
            const mockValidate = jest.fn();

            const {container} = renderWithContext(
                <Input
                    testId='fixture.input'
                    name='test'
                    value=''
                    validate={mockValidate}
                />,
            );

            const input = container.querySelector('input') as HTMLInputElement;

            // Create button and ensure it has click method
            const button = document.createElement('button');
            document.body.appendChild(button);

            await act(async () => {
                fireEvent.focus(input);

                // Manually trigger the blur with relatedTarget
                const event = {
                    target: input,
                    relatedTarget: button,
                    preventDefault: jest.fn(),
                    stopPropagation: jest.fn(),
                } as any;

                fireEvent.blur(input, event);
            });

            // Should not validate immediately
            expect(mockValidate).not.toHaveBeenCalled();

            // Click the button
            await act(async () => {
                await userEvent.click(button);
            });

            // Should validate after click
            expect(mockValidate).toHaveBeenCalledTimes(1);

            document.body.removeChild(button);
        });
    });

    describe('minLength validation', () => {
        test('should show error styling when input is empty with minLength set', async () => {
            renderWithContext(
                <Input
                    testId='fixture.input'
                    value={''}
                    minLength={2}
                />,
            );

            // Find the input and blur it to trigger validation
            const inputElement = screen.getByRole('textbox');
            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            // Check for error styling
            const fieldset = screen.getByTestId('fixture.input.field');
            expect(fieldset).toHaveClass('Input_fieldset___error');

            // Check for error message
            const errorMessage = screen.getByText(/Must be at least 2 characters/i);
            expect(errorMessage).toBeInTheDocument();
        });

        test('should show error styling and message when input length < minLength', async () => {
            renderWithContext(
                <Input
                    testId='fixture.input'
                    value={'a'}
                    minLength={2}
                />,
            );

            // Find the input
            const inputElement = screen.getByDisplayValue('a');

            // Clear the input first
            // Simulate change to trigger validation
            await userEvent.clear(inputElement);
            await userEvent.type(inputElement, 'a');
            act(() => inputElement.blur());

            // Check for error styling
            const fieldset = screen.getByTestId('fixture.input.field');
            expect(fieldset).toHaveClass('Input_fieldset___error');

            // Check for error message
            const errorMessage = await screen.findByText(/Must be at least 2 characters/i);
            expect(errorMessage).toBeInTheDocument();
        });

        test('should not show error styling when input length >= minLength', async () => {
            const onChange = jest.fn();

            renderWithContext(
                <Input
                    testId='fixture.input'
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
                    testId='fixture.input'
                    value={'abcdef'}
                    limit={5}
                    onChange={onChange}
                />,
            );

            // Find the input and blur it to trigger validation
            const inputElement = screen.getByRole('textbox');
            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            // Check for error styling
            const fieldset = screen.getByTestId('fixture.input.field');
            expect(fieldset).toHaveClass('Input_fieldset___error');
        });

        test('should not show error styling when input length <= limit', async () => {
            const onChange = jest.fn();

            renderWithContext(
                <Input
                    testId='fixture.input'
                    value={'abcde'}
                    limit={5}
                    onChange={onChange}
                />,
            );

            // Check that error message is not present
            expect(screen.queryByText(/Must be no more than 5 characters/i)).not.toBeInTheDocument();
        });
    });

    describe('required field validation', () => {
        test('should not show error on empty required input until blur', async () => {
            renderWithContext(
                <Input
                    testId='fixture.input'
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
            const fieldset = screen.getByTestId('fixture.input.field');
            expect(fieldset).toHaveClass('Input_fieldset___error');
        });

        test('should not show error on non-empty required input', async () => {
            renderWithContext(
                <Input
                    testId='fixture.input'
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
                    testId='fixture.input'
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
    });
});
