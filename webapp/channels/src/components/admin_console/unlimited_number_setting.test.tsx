// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import UnlimitedNumberSetting from './unlimited_number_setting';

describe('components/admin_console/UnlimitedNumberSetting', () => {
    const baseProps = {
        id: 'test.setting.id',
        label: 'Test Label',
        helpText: 'Test help text',
        value: 10,
        onChange: jest.fn(),
        disabled: false,
        setByEnv: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders with numeric value - number input shows value, checkbox unchecked', () => {
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={10}
            />,
        );

        const numberInput = screen.getByTestId('test.setting.idnumber') as HTMLInputElement;
        const checkbox = screen.getByTestId('test.setting.idcheckbox') as HTMLInputElement;

        expect(numberInput).toHaveValue(10);
        expect(numberInput).not.toBeDisabled();
        expect(checkbox).not.toBeChecked();
        screen.getByText('Test Label');
        screen.getByText('Test help text');
    });

    test('renders with unlimited value (-1) - checkbox checked, number input disabled', () => {
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={-1}
            />,
        );

        const numberInput = screen.getByTestId('test.setting.idnumber') as HTMLInputElement;
        const checkbox = screen.getByTestId('test.setting.idcheckbox') as HTMLInputElement;

        expect(checkbox).toBeChecked();
        expect(numberInput).toBeDisabled();
        expect(numberInput).toHaveValue(null); // Empty when unlimited
    });

    test('checking Unlimited calls onChange with -1', () => {
        const onChange = jest.fn();
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={10}
                onChange={onChange}
            />,
        );

        const checkbox = screen.getByTestId('test.setting.idcheckbox');
        fireEvent.click(checkbox);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('test.setting.id', -1);
    });

    test('unchecking Unlimited calls onChange with default value', () => {
        const onChange = jest.fn();
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={-1}
                defaultValue={5}
                onChange={onChange}
            />,
        );

        const checkbox = screen.getByTestId('test.setting.idcheckbox');
        fireEvent.click(checkbox);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('test.setting.id', 5);
    });

    test('unchecking Unlimited uses defaultValue of 1 when not specified', () => {
        const onChange = jest.fn();
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={-1}
                onChange={onChange}
            />,
        );

        const checkbox = screen.getByTestId('test.setting.idcheckbox');
        fireEvent.click(checkbox);

        expect(onChange).toHaveBeenCalledWith('test.setting.id', 1);
    });

    test('number input change calls onChange with parsed number', () => {
        const onChange = jest.fn();
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={10}
                onChange={onChange}
            />,
        );

        const numberInput = screen.getByTestId('test.setting.idnumber');
        fireEvent.change(numberInput, {target: {value: '25'}});

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('test.setting.id', 25);
    });

    test('disabled prop disables both inputs', () => {
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={10}
                disabled={true}
            />,
        );

        const numberInput = screen.getByTestId('test.setting.idnumber') as HTMLInputElement;
        const checkbox = screen.getByTestId('test.setting.idcheckbox') as HTMLInputElement;

        expect(numberInput).toBeDisabled();
        expect(checkbox).toBeDisabled();
    });

    test('setByEnv shows SetByEnv footer and disables both inputs', () => {
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={10}
                setByEnv={true}
            />,
        );

        const numberInput = screen.getByTestId('test.setting.idnumber') as HTMLInputElement;
        const checkbox = screen.getByTestId('test.setting.idcheckbox') as HTMLInputElement;

        expect(numberInput).toBeDisabled();
        expect(checkbox).toBeDisabled();

        // SetByEnv component renders a warning message
        expect(screen.getByText(/This setting has been set through an environment variable/)).toBeInTheDocument();
    });

    test('custom unlimited label is displayed', () => {
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={10}
                unlimitedLabel='No Limit'
            />,
        );

        screen.getByText('No Limit');
    });

    test('placeholder is shown on number input when not unlimited', () => {
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={10}
                placeholder='Enter a number'
            />,
        );

        const numberInput = screen.getByTestId('test.setting.idnumber') as HTMLInputElement;
        expect(numberInput).toHaveAttribute('placeholder', 'Enter a number');
    });

    test('unlimited label is shown as placeholder when unlimited is checked', () => {
        renderWithContext(
            <UnlimitedNumberSetting
                {...baseProps}
                value={-1}
                unlimitedLabel='No Limit'
            />,
        );

        const numberInput = screen.getByTestId('test.setting.idnumber') as HTMLInputElement;
        expect(numberInput).toHaveAttribute('placeholder', 'No Limit');
    });
});
