// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PermissionCheckbox from 'components/admin_console/permission_schemes_settings/permission_checkbox';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/admin_console/permission_schemes_settings/permission_checkbox', () => {
    test('should match snapshot on no value', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on value "checked" and no id', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox value='checked'/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on value "checked"', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox
                value='checked'
                id='uniqId-checked'
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('uniqId-checked')).toHaveClass('checked');
    });

    test('should match snapshot on value "intermediate"', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox
                value='intermediate'
                id='uniqId-checked'
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('uniqId-checked')).toHaveClass('intermediate');
    });

    test('should match snapshot on other value', () => {
        const {container} = renderWithContext(
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
