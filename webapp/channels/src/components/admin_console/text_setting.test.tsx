// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen} from 'tests/react_testing_utils';

import AdminTextSetting from './text_setting';

describe('components/admin_console/TextSetting', () => {
    test('render component with required props', () => {
        const onChange = jest.fn();
        renderWithIntl(
            <AdminTextSetting
                id='string.id'
                label='some label'
                value='some value'
                onChange={onChange}
                setByEnv={false}
                labelClassName=''
                inputClassName=''
                maxLength={-1}
                resizable={true}
                type='text'
            />,
        );

        screen.getByText('some label', {exact: false});
        expect(screen.getByTestId('string.idinput')).toHaveProperty('id', 'string.id');
        expect(screen.getByTestId('string.idinput')).toHaveValue('some value');
    });
});
