// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import SystemRolePermissionDropdown from './system_role_permission_dropdown';
import {readAccess} from './types';

describe('admin_console/system_role_permission_dropdown', () => {
    const props = {
        section: {
            name: 'environemnt',
            hasDescription: true,
            subsections: [],
        },
        access: readAccess,
        updatePermissions: vi.fn(),
        isDisabled: false,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SystemRolePermissionDropdown
                {...props}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with isDisabledTrue', () => {
        const {container} = renderWithContext(
            <SystemRolePermissionDropdown
                {...props}
                isDisabled={true}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
