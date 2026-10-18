// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import TextSetting from './text_setting';

describe('components/widgets/settings/TextSetting', () => {
    test('should render Compass Input with floating label for text type', () => {
        const onChange = jest.fn();
        const {container} = render(
            <TextSetting
                id='string.id'
                label='some label'
                value='some value'
                onChange={onChange}
            />,
        );

        expect(screen.getByText('some label')).toBeInTheDocument();

        const input = screen.getByTestId('string.idinput');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('some value');
        expect(input).toHaveAttribute('type', 'text');
        expect(input).toHaveAttribute('id', 'string.id');
        expect(input).not.toHaveClass('form-control');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();

        // Floating label replaces the Setting column label
        expect(screen.queryByTestId('string.idlabel')).not.toBeInTheDocument();
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

        expect(screen.getByText('some label')).toBeInTheDocument();

        const textarea = screen.getByTestId('string.idinput');
        expect(textarea).toBeInTheDocument();
        expect(textarea.tagName).toBe('TEXTAREA');
        expect(textarea).toHaveValue('some value');
        expect(textarea).not.toHaveClass('form-control');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();
    });

    test('should use FormattedMessage label as floating label', () => {
        const onChange = jest.fn();
        render(
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

        expect(screen.getByText('Membership policy name:')).toBeInTheDocument();
        expect(screen.getByTestId('policy.nameinput')).toHaveAttribute('id', 'policy.name');
        expect(screen.getByPlaceholderText('Add a unique policy name')).toBeInTheDocument();
        expect(screen.queryByTestId('policy.namelabel')).not.toBeInTheDocument();
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

    test('should keep native form-control for number type', () => {
        const onChange = jest.fn();
        render(
            <TextSetting
                id='string.id'
                label='some label'
                value={42}
                type='number'
                onChange={onChange}
            />,
        );

        const input = screen.getByTestId('string.idnumber');
        expect(input).toHaveClass('form-control');
        expect(input).toHaveAttribute('type', 'number');
        expect(screen.getByTestId('string.idlabel')).toBeInTheDocument();
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
    });
});
