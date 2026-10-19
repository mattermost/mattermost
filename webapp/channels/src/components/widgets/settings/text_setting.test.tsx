// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {fireEvent, render, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import TextSetting from './text_setting';

describe('components/widgets/settings/TextSetting', () => {
    test('should render Compass Input without floating label for text type', () => {
        const onChange = jest.fn();
        const {container} = render(
            <TextSetting
                id='string.id'
                label='some label'
                value='some value'
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('string.idlabel')).toHaveTextContent('some label');

        const input = screen.getByTestId('string.idinput');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('some value');
        expect(input).toHaveAttribute('type', 'text');
        expect(input).toHaveAttribute('id', 'string.id');
        expect(input).not.toHaveClass('form-control');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();

        // Non-floating: no legend/label inside the Compass field
        expect(container.querySelector('legend')).not.toBeInTheDocument();
    });

    test('should render Compass TextArea for textarea type', () => {
        const onChange = jest.fn();
        const {container} = render(
            <TextSetting
                id='string.id'
                label='some label'
                value='some value'
                type='textarea'
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('string.idlabel')).toHaveTextContent('some label');

        const textarea = screen.getByTestId('string.idinput');
        expect(textarea).toBeInTheDocument();
        expect(textarea.tagName).toBe('TEXTAREA');
        expect(textarea).toHaveValue('some value');
        expect(textarea).not.toHaveClass('form-control');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();
        expect(container.querySelector('legend')).not.toBeInTheDocument();
    });

    test('should keep Setting column label for FormattedMessage labels', () => {
        const onChange = jest.fn();
        renderWithContext(
            <TextSetting
                id='policy.name'
                label={
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.policyName'
                        defaultMessage='Membership policy name:'
                    />
                }
                value=''
                placeholder='Add a unique policy name'
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('policy.namelabel')).toHaveTextContent('Membership policy name:');
        expect(screen.getByTestId('policy.nameinput')).toHaveAttribute('id', 'policy.name');
        expect(screen.getByPlaceholderText('Add a unique policy name')).toBeInTheDocument();
    });

    test('should keep Setting column label for complex ReactNode labels', () => {
        const onChange = jest.fn();
        render(
            <TextSetting
                id='apps.field'
                label={
                    <>
                        {'Display Name'}
                        <span className='error-text'>{' *'}</span>
                    </>
                }
                value=''
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('apps.fieldlabel')).toBeInTheDocument();
        expect(screen.getByTestId('apps.fieldinput')).toBeInTheDocument();
    });

    test('should render Compass Input without floating label for number type', () => {
        const onChange = jest.fn();
        const {container} = render(
            <TextSetting
                id='string.id'
                label='some label'
                value={42}
                type='number'
                min={1}
                max={100}
                step={1}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('string.idlabel')).toHaveTextContent('some label');

        const input = screen.getByTestId('string.idnumber');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue(42);
        expect(input).toHaveAttribute('type', 'number');
        expect(input).toHaveAttribute('id', 'string.id');
        expect(input).toHaveAttribute('min', '1');
        expect(input).toHaveAttribute('max', '100');
        expect(input).toHaveAttribute('step', '1');
        expect(input).not.toHaveClass('form-control');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();
        expect(container.querySelector('legend')).not.toBeInTheDocument();
    });

    test('should parse number onChange for number type', () => {
        const onChange = jest.fn();
        render(
            <TextSetting
                id='string.id'
                label='some label'
                value={1}
                type='number'
                onChange={onChange}
            />,
        );

        const input = screen.getByTestId('string.idnumber');
        fireEvent.change(input, {target: {value: '7'}});

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 7);
    });

    test('should call onChange when input value changes', async () => {
        const onChange = jest.fn();
        render(
            <TextSetting
                id='string.id'
                label='some label'
                value='some value'
                onChange={onChange}
            />,
        );

        const input = screen.getByTestId('string.idinput');

        // Type a single character to trigger onChange
        await userEvent.type(input, 'x');

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 'some valuex');
    });

    test('should preserve disabled, maxLength, and help text layout', () => {
        const onChange = jest.fn();
        render(
            <TextSetting
                id='string.id'
                label='some label'
                value='val'
                disabled={true}
                maxLength={10}
                helpText='help me'
                onChange={onChange}
            />,
        );

        const input = screen.getByTestId('string.idinput');
        expect(input).toBeDisabled();
        expect(input).toHaveAttribute('maxLength', '10');
        expect(screen.getByTestId('string.idhelp-text')).toHaveTextContent('help me');
        expect(screen.getByTestId('string.idlabel')).toHaveTextContent('some label');
    });

    test.each([
        ['url', 'URLurl', 'https://example.com'],
        ['email', 'useremail', 'user@example.com'],
        ['tel', 'phonetel', '+15551212'],
    ] as const)('should render Compass Input without floating label for %s type', (type, testId, value) => {
        const onChange = jest.fn();
        const id = testId.replace(new RegExp(`${type}$`), '');
        const {container} = render(
            <TextSetting
                id={id}
                label='some label'
                value={value}
                type={type}
                placeholder={`Enter ${type}`}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId(`${id}label`)).toHaveTextContent('some label');

        const input = screen.getByTestId(testId);
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue(value);
        expect(input).toHaveAttribute('type', type);
        expect(input).toHaveAttribute('id', id);
        expect(input).toHaveAttribute('placeholder', `Enter ${type}`);
        expect(input).not.toHaveClass('form-control');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();
        expect(container.querySelector('legend')).not.toBeInTheDocument();
    });

    test('should render Compass PasswordInput without floating label for password type', () => {
        const onChange = jest.fn();
        const {container} = renderWithContext(
            <TextSetting
                id='APIKey'
                label='API Key'
                value='secret'
                type='password'
                placeholder='Enter API Key'
                maxLength={64}
                disabled={false}
                helpText='optional key'
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('APIKeylabel')).toHaveTextContent('API Key');

        const input = screen.getByTestId('APIKeypassword');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('secret');
        expect(input).toHaveAttribute('type', 'password');
        expect(input).toHaveAttribute('id', 'APIKey');
        expect(input).toHaveAttribute('placeholder', 'Enter API Key');
        expect(input).toHaveAttribute('maxLength', '64');
        expect(input).not.toHaveClass('form-control');
        expect(container.querySelector('.password-input')).toBeInTheDocument();
        expect(container.querySelector('.password-input label')).not.toBeInTheDocument();
        expect(screen.getByTestId('APIKeyhelp-text')).toHaveTextContent('optional key');
    });
});
