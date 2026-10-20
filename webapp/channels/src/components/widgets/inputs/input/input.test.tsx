// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Input from './input';

describe('components/widgets/inputs/Input', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <Input/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should keep defaultValue across re-renders when value is omitted (uncontrolled / IME)', () => {
        const {rerender} = renderWithContext(
            <Input defaultValue=''/>,
        );
        const input = screen.getByRole('textbox') as HTMLInputElement;

        fireEvent.input(input, {target: {value: '그'}});
        rerender(
            <Input defaultValue=''/>,
        );

        expect(input.value).toBe('그');
    });

    test('should render with clearable enabled', async () => {
        const value = 'value';
        const onClear = jest.fn();

        renderWithContext(
            <Input
                value={value}
                clearable={true}
                onClear={onClear}
            />,
        );

        const inputElement = screen.getByDisplayValue(value);
        expect(inputElement).toBeInTheDocument();

        const clearButton = screen.getByRole('button', {name: /clear/i});
        expect(clearButton).toBeInTheDocument();

        await userEvent.click(clearButton);

        expect(onClear).toHaveBeenCalledTimes(1);
    });

    describe('handleOnBlur functionality', () => {
        test('should validate immediately when blur occurs without relatedTarget', async () => {
            const mockValidate = jest.fn();
            const mockOnBlur = jest.fn();

            const {container} = renderWithContext(
                <Input
                    name='test'
                    value=''
                    validate={mockValidate}
                    onBlur={mockOnBlur}
                />,
            );

            const input = container.querySelector('input') as HTMLInputElement;

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
                    name='test'
                    value=''
                    validate={mockValidate}
                />,
            );

            const input = container.querySelector('input') as HTMLInputElement;

            const button = document.createElement('button');
            document.body.appendChild(button);

            await act(async () => {
                fireEvent.focus(input);

                const event = {
                    target: input,
                    relatedTarget: button,
                    preventDefault: jest.fn(),
                    stopPropagation: jest.fn(),
                } as any;

                fireEvent.blur(input, event);
            });

            expect(mockValidate).not.toHaveBeenCalled();

            await act(async () => {
                await userEvent.click(button);
            });

            expect(mockValidate).toHaveBeenCalledTimes(1);

            document.body.removeChild(button);
        });
    });

    describe('minLength validation', () => {
        test('should show error styling when input is empty with minLength set', async () => {
            renderWithContext(
                <Input
                    value={''}
                    minLength={2}
                />,
            );

            const inputElement = screen.getByRole('textbox');
            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            expect(inputElement).toHaveAttribute('aria-invalid', 'true');

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

            const inputElement = screen.getByDisplayValue('a');

            await userEvent.clear(inputElement);
            await userEvent.type(inputElement, 'a');
            act(() => inputElement.blur());

            expect(inputElement).toHaveAttribute('aria-invalid', 'true');

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

            expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Must be at least 2 characters/i)).not.toBeInTheDocument();
        });
    });

    describe('maxLength (limit) validation', () => {
        test('should show error styling when input length > limit', async () => {
            const onChange = jest.fn();

            renderWithContext(
                <Input
                    value={'abcdef'}
                    limit={5}
                    onChange={onChange}
                />,
            );

            const inputElement = screen.getByRole('textbox');
            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            expect(inputElement).toHaveAttribute('aria-invalid', 'true');
            expect(await screen.findByText(/Must be no more than 5 characters/i)).toBeInTheDocument();
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

            expect(screen.queryByText(/Must be no more than 5 characters/i)).not.toBeInTheDocument();
        });

        test('should show Compass character count when showCharacterCount is set with limit', () => {
            renderWithContext(
                <Input
                    value={'abc'}
                    limit={5}
                    showCharacterCount={true}
                />,
            );

            expect(screen.getByText('3 / 5')).toBeInTheDocument();
            expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '5');
        });

        test('should show Compass character count when showCharacterCount is set with maxLength', () => {
            renderWithContext(
                <Input
                    value={'hi'}
                    maxLength={64}
                    showCharacterCount={true}
                />,
            );

            expect(screen.getByText('2 / 64')).toBeInTheDocument();
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

            const inputElement = screen.getByRole('textbox');

            expect(screen.queryByText(/This field is required/i)).not.toBeInTheDocument();

            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            const errorMessage = await screen.findByText(/This field is required/i);
            expect(errorMessage).toBeInTheDocument();

            expect(inputElement).toHaveAttribute('aria-invalid', 'true');
        });

        test('should not show error on non-empty required input', async () => {
            renderWithContext(
                <Input
                    value={'abc'}
                    required={true}
                />,
            );

            const inputElement = screen.getByDisplayValue('abc');

            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            expect(screen.queryByText(/This field is required/i)).not.toBeInTheDocument();
        });
    });

    describe('useLegend=false placeholder', () => {
        test('should keep placeholder while focused when there is no floating label', async () => {
            renderWithContext(
                <Input
                    name='project_name'
                    useLegend={false}
                    placeholder='Enter project name'
                />,
            );

            const inputElement = screen.getByRole('textbox');
            expect(inputElement).toHaveAttribute('placeholder', 'Enter project name');

            await act(async () => {
                inputElement.focus();
            });

            expect(inputElement).toHaveAttribute('placeholder', 'Enter project name');
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

            const inputElement = screen.getByRole('textbox');

            await act(async () => {
                inputElement.focus();
                inputElement.blur();
            });

            const errorMessage = await screen.findByText(/This field is required/i);
            expect(errorMessage).toBeInTheDocument();

            expect(screen.queryByText(/Must be at least 2 characters/i)).not.toBeInTheDocument();
        });
    });
});
