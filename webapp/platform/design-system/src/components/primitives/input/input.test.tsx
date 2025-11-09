// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, fireEvent, render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {IntlProvider} from 'react-intl';

import Input from './input';

// Test wrapper with IntlProvider
const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

// Mock the WithTooltip component to avoid ref issues
jest.mock('../with_tooltip', () => {
    return function WithTooltip({children}: {children: React.ReactNode}) {
        return <>{children}</>;
    };
});

// Mock the CloseCircleIcon component to avoid ref issues
jest.mock('@mattermost/compass-icons/components', () => ({
    CloseCircleIcon: () => <div data-testid='close-circle-icon'/>,
}));

describe('Input', () => {
    test('should render basic input', () => {
        const {container} = renderWithIntl(<Input/>);
        const input = container.querySelector('input');
        expect(input).toBeInTheDocument();
    });

    test('should render with value', () => {
        renderWithIntl(<Input value='test value'/>);
        const input = screen.getByDisplayValue('test value');
        expect(input).toBeInTheDocument();
    });

    test('should render with clearable enabled', async () => {
        const value = 'value';
        const onClear = jest.fn();

        renderWithIntl(
            <Input
                value={value}
                clearable={true}
                onClear={onClear}
            />,
        );

        const inputElement = screen.getByDisplayValue(value);
        expect(inputElement).toBeInTheDocument();

        const iconElement = screen.getByTestId('close-circle-icon');
        expect(iconElement).toBeInTheDocument();

        await userEvent.click(iconElement);
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    describe('handleOnBlur functionality', () => {
        test('should validate immediately when blur occurs', async () => {
            const mockValidate = jest.fn();
            const mockOnBlur = jest.fn();

            const {container} = renderWithIntl(
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
    });

    describe('minLength validation', () => {
        test('should show error styling when input is empty with minLength set', async () => {
            renderWithIntl(
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

            const fieldset = screen.getByTestId('input-wrapper');
            expect(fieldset).toHaveClass('Input_fieldset___error');

            const errorMessage = screen.getByText(/Must be at least 2 characters/i);
            expect(errorMessage).toBeInTheDocument();
        });

        test('should not show error styling when input length >= minLength', async () => {
            renderWithIntl(
                <Input
                    value={'ab'}
                    minLength={2}
                />,
            );

            expect(screen.queryByText(/Must be at least 2 characters/i)).not.toBeInTheDocument();
        });
    });

    describe('maxLength (limit) validation', () => {
        test('should show error styling when input length > limit', async () => {
            const onChange = jest.fn();

            renderWithIntl(
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

            const fieldset = screen.getByTestId('input-wrapper');
            expect(fieldset).toHaveClass('Input_fieldset___error');
        });

        test('should not show error styling when input length <= limit', async () => {
            renderWithIntl(
                <Input
                    value={'abcde'}
                    limit={5}
                />,
            );

            expect(screen.queryByText(/Must be no more than 5 characters/i)).not.toBeInTheDocument();
        });
    });

    describe('required field validation', () => {
        test('should not show error on empty required input until blur', async () => {
            renderWithIntl(
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

            const fieldset = screen.getByTestId('input-wrapper');
            expect(fieldset).toHaveClass('Input_fieldset___error');
        });

        test('should not show error on non-empty required input', async () => {
            renderWithIntl(
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

    describe('interaction between validations', () => {
        test('should prioritize required validation over minLength on blur for empty input', async () => {
            renderWithIntl(
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
