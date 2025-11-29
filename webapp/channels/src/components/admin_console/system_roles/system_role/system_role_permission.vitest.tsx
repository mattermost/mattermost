// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRolePermission from './system_role_permission';
import {readAccess} from './types';

describe('admin_console/system_role_permission', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        // Run all pending timers and animation frames before cleanup
        act(() => {
            vi.runAllTimers();
        });
        vi.useRealTimers();
    });

    test('should match snapshot', () => {
        const props = {
            readOnly: true,
            setSectionVisible: vi.fn(),
            section: {
                name: 'environment',
                hasDescription: true,
                subsections: [],
            },
            permissionsMap: {
                sysconsole_read_environment: true,
            },
            visibleSections: {},
            permissionsToUpdate: {
                environment: readAccess,
            },
            updatePermissions: vi.fn(),
            roles: {
                system_admin: TestHelper.getRoleMock(),
            },
        };

        const {container} = renderWithContext(
            <SystemRolePermission
                {...props}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
