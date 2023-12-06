// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import SystemRolePermission from './system_role_permission';
import SystemRolePermissions from './system_role_permissions';
import {readAccess, writeAccess} from './types';

describe('admin_console/system_role_permissions', () => {
    const props = {
        isLicensedForCloud: false,
        updatePermissions: jest.fn(),
        permissionsToUpdate: {
            environment: readAccess,
            plugins: writeAccess,
            site: writeAccess,
        },
        role: TestHelper.getRoleMock(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SystemRolePermissions
                {...props}
            />);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with isLicensedForCloud = true', () => {
        const wrapper = shallow(
            <SystemRolePermissions
                {...props}
                isLicensedForCloud={true}
            />);

        expect(wrapper).toMatchSnapshot();
    });

    test('ensure that when you change a prop and component is re-rendered, SystemRolePermission is not being deleted due to isLicensedForCloud being false (test for bug MM-31403)', () => {
        const wrapper = shallow(
            <SystemRolePermissions
                {...props}
            />);

        const expectedLength = 8;
        let systemRolePermissionLength = wrapper.find(SystemRolePermission).length;
        expect(systemRolePermissionLength).toEqual(expectedLength);
        wrapper.setProps({permissionToUpdate: {
            environment: writeAccess,
            plugins: readAccess,
        }});
        systemRolePermissionLength = wrapper.find(SystemRolePermission).length;
        expect(systemRolePermissionLength).toEqual(expectedLength);
    });
});
