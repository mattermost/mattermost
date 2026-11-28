// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, within} from 'tests/react_testing_utils';

import AdminTextSetting from './text_setting';

describe('components/admin_console/TextSetting', () => {
    test('render component with required props', () => {
        renderWithContext(
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
        expect(within(screen.getByTestId('admin.setting:some.id--group')).getByTestId('admin.setting.value--textbox')).toHaveProperty('id', 'some.id');
        expect(within(screen.getByTestId('admin.setting:some.id--group')).getByTestId('admin.setting.value--textbox')).toHaveValue('some value');
    });
});
