// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen} from 'tests/react_testing_utils';

import AdminTextSetting from './text_setting';

describe('components/admin_console/TextSetting', () => {
    test('render component with required props', () => {
        renderWithIntl(
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

        screen.getByText('some label', {exact: false});
        expect(screen.getByTestId('some.idinput')).toHaveProperty('id', 'some.id');
        expect(screen.getByTestId('some.idinput')).toHaveValue('some value');
    });
});
