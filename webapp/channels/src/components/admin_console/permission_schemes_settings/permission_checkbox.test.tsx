// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PermissionCheckbox from 'components/admin_console/permission_schemes_settings/permission_checkbox';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/admin_console/permission_schemes_settings/permission_checkbox', () => {
    test('should match snapshot on no value', async () => {
        const {container} = await renderWithContext(
            <PermissionCheckbox/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on value "checked" and no id', async () => {
        const {container} = await renderWithContext(
            <PermissionCheckbox value='checked'/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on value "checked"', async () => {
        const {container} = await renderWithContext(
            <PermissionCheckbox
                value='checked'
                id='uniqId-checked'
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('uniqId-checked')).toHaveClass('checked');
    });

    test('should match snapshot on value "intermediate"', async () => {
        const {container} = await renderWithContext(
            <PermissionCheckbox
                value='intermediate'
                id='uniqId-checked'
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('uniqId-checked')).toHaveClass('intermediate');
    });

    test('should match snapshot on other value', async () => {
        const {container} = await renderWithContext(
            <PermissionCheckbox
                value='other'
                id='uniqId-checked'
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('uniqId-checked')).toHaveClass('permission-check');
        expect(screen.getByTestId('uniqId-checked')).not.toHaveClass('checked');
        expect(screen.getByTestId('uniqId-checked')).not.toHaveClass('intermediate');
    });
});
