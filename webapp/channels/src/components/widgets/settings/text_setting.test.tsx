// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import TextSetting from './text_setting';

describe('components/widgets/settings/TextSetting', () => {
    test('should render component with required props', () => {
        const onChange = jest.fn();
        render(
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
        expect(input).toHaveClass('form-control');
    });

    test('should render with textarea type', () => {
        const onChange = jest.fn();
        render(
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
        expect(textarea).toHaveClass('form-control');
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
});
