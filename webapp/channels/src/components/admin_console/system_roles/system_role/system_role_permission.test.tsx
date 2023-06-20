// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import {readAccess} from './types';

import SystemRolePermission from './system_role_permission';

describe('admin_console/system_role_permission', () => {
    test('should match snapshot', () => {
        const props = {
            readOnly: true,
            setSectionVisible: jest.fn(),
            section: {
                name: 'environemnt',
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
            updatePermissions: jest.fn(),
            roles: {
                system_admin: TestHelper.getRoleMock(),
            },
        };

        const wrapper = shallow(
            <SystemRolePermission
                {...props}
            />);

        expect(wrapper).toMatchSnapshot();
    });
});
