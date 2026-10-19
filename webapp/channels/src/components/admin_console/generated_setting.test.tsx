// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import GeneratedSetting from './generated_setting';

// Matches server model.FakeSetting — sanitized PublicLinkSalt display value.
const FAKE_SALT = '********************************';

describe('components/admin_console/GeneratedSetting', () => {
    const baseProps = {
        id: 'FileSettings.PublicLinkSalt',
        label: 'Public Link Salt:',
        helpText: '32-character salt for public links.',
        value: FAKE_SALT,
        onChange: jest.fn(),
        disabled: false,
        setByEnv: false,
    };

    test('renders sanitized value as disabled Compass TextInput with left-column label', () => {
        const {container} = renderWithContext(
            <GeneratedSetting {...baseProps}/>,
        );

        expect(screen.getByText('Public Link Salt:')).toBeInTheDocument();

        const input = screen.getByTestId('FileSettings.PublicLinkSaltinput') as HTMLInputElement;
        expect(input).toHaveAttribute('type', 'text');
        expect(input).toHaveAttribute('id', 'FileSettings.PublicLinkSalt');
        expect(input).toHaveValue(FAKE_SALT);
        expect(input).toBeDisabled();
        expect(input).not.toHaveAttribute('readonly');
        expect(input).not.toHaveClass('form-control');

        // Shared Input → Compass TextInput; no floating legend.
        const fieldRoot = input.closest('.Input_container');
        expect(fieldRoot).toBeInTheDocument();
        expect(fieldRoot).toHaveClass('disabled');
        expect(fieldRoot!.querySelector('legend')).not.toBeInTheDocument();

        // Not a password field — no reveal control.
        expect(container.querySelector('[data-testid$="password"]')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /show|hide|reveal/i})).not.toBeInTheDocument();

        expect(screen.getByText('32-character salt for public links.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Regenerate'})).toBeEnabled();
    });

    test('shows placeholder when value is empty', () => {
        renderWithContext(
            <GeneratedSetting
                {...baseProps}
                value=''
                placeholder='e.g. 47KyfOxtk5+ovi1MDHFyzMDHIA6esMWb'
            />,
        );

        const input = screen.getByTestId('FileSettings.PublicLinkSaltinput');
        expect(input).toHaveValue('');
        expect(input).toHaveAttribute('placeholder', 'e.g. 47KyfOxtk5+ovi1MDHFyzMDHIA6esMWb');
        expect(input).toBeDisabled();
    });

    test('Regenerate calls onChange with a new generated value', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <GeneratedSetting
                {...baseProps}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Regenerate'}));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(
            'FileSettings.PublicLinkSalt',
            expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
        );
        expect(onChange.mock.calls[0][1]).not.toBe(FAKE_SALT);
    });

    test('disables Regenerate when setting is disabled or set by env', () => {
        const {rerender} = renderWithContext(
            <GeneratedSetting
                {...baseProps}
                disabled={true}
            />,
        );
        expect(screen.getByRole('button', {name: 'Regenerate'})).toBeDisabled();

        rerender(
            <GeneratedSetting
                {...baseProps}
                disabled={false}
                setByEnv={true}
            />,
        );
        expect(screen.getByRole('button', {name: 'Regenerate'})).toBeDisabled();
        expect(screen.getByText(/environment variable/i)).toBeInTheDocument();
    });

    test('does not call onChange when the disabled display input is interacted with', () => {
        const onChange = jest.fn();
        renderWithContext(
            <GeneratedSetting
                {...baseProps}
                onChange={onChange}
            />,
        );

        const input = screen.getByTestId('FileSettings.PublicLinkSaltinput');
        fireEvent.change(input, {target: {value: 'should-not-stick'}});

        expect(onChange).not.toHaveBeenCalled();
        expect(input).toHaveValue(FAKE_SALT);
    });
});
