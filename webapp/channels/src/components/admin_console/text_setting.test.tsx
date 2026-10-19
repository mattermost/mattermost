// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AdminTextSetting from './text_setting';

describe('components/admin_console/TextSetting', () => {
    test('render component with required props', () => {
        const {container} = renderWithContext(
            <AdminTextSetting
                id='some.id'
                label='some label'
                value='some value'
                onChange={jest.fn()}
                setByEnv={false}
                labelClassName=''
                inputClassName=''
                maxLength={-1}
                resizable={true}
            />,
        );

        expect(screen.getByTestId('some.idlabel')).toHaveTextContent('some label');
        expect(screen.getByTestId('some.idinput')).toHaveProperty('id', 'some.id');
        expect(screen.getByTestId('some.idinput')).toHaveValue('some value');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();
        expect(screen.getByTestId('some.idinput')).not.toHaveClass('form-control');
        expect(container.querySelector('legend')).not.toBeInTheDocument();
    });

    test('disables input and shows SetByEnv when setByEnv', () => {
        renderWithContext(
            <AdminTextSetting
                id='some.id'
                label='some label'
                value='some value'
                onChange={jest.fn()}
                setByEnv={true}
            />,
        );

        expect(screen.getByTestId('some.idinput')).toBeDisabled();
        expect(screen.getByText(/environment variable/i)).toBeInTheDocument();
    });

    test('renders Compass number input with left label and SetByEnv footer', () => {
        const {container} = renderWithContext(
            <AdminTextSetting
                id='ServiceSettings.ReadTimeout'
                label='Read Timeout'
                value={300}
                type='number'
                onChange={jest.fn()}
                setByEnv={true}
                helpText='help'
            />,
        );

        expect(screen.getByTestId('ServiceSettings.ReadTimeoutlabel')).toHaveTextContent('Read Timeout');
        const input = screen.getByTestId('ServiceSettings.ReadTimeoutnumber');
        expect(input).toHaveAttribute('type', 'number');
        expect(input).toHaveAttribute('id', 'ServiceSettings.ReadTimeout');
        expect(input).toBeDisabled();
        expect(input).not.toHaveClass('form-control');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();
        expect(container.querySelector('legend')).not.toBeInTheDocument();
        expect(screen.getByTestId('ServiceSettings.ReadTimeouthelp-text')).toHaveTextContent('help');
        expect(screen.getByText(/environment variable/i)).toBeInTheDocument();
    });
});
