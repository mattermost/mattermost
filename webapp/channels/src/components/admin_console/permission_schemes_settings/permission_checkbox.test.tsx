// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PermissionCheckbox from 'components/admin_console/permission_schemes_settings/permission_checkbox';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/admin_console/permission_schemes_settings/permission_checkbox', () => {
    test('should render on value "checked"', () => {
        renderWithContext(
            <PermissionCheckbox
                value='checked'
                id='uniqId-checked'
            />,
        );
        expect(screen.getByTestId('uniqId-checked')).toHaveClass('checked');
    });

    test('should render on value "intermediate"', () => {
        renderWithContext(
            <PermissionCheckbox
                value='intermediate'
                id='uniqId-checked'
            />,
        );
        expect(screen.getByTestId('uniqId-checked')).toHaveClass('intermediate');
    });

    test('should render on other value', () => {
        renderWithContext(
            <PermissionCheckbox
                value='other'
                id='uniqId-checked'
            />,
        );
        expect(screen.getByTestId('uniqId-checked')).toHaveClass('permission-check');
        expect(screen.getByTestId('uniqId-checked')).not.toHaveClass('checked');
        expect(screen.getByTestId('uniqId-checked')).not.toHaveClass('intermediate');
    });
});
