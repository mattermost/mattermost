// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRoles from './system_roles';

describe('admin_console/system_roles', () => {
    test('should match snapshot', () => {
        const roles = {
            system_admin: TestHelper.getRoleMock({
                id: 'system_admin',
                name: 'system_admin',
                permissions: ['some', 'random', 'permissions'],
            }),
        };

        const {container} = renderWithContext(
            <SystemRoles
                roles={roles}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
