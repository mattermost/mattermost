// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

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
        updatePermissions: jest.fn(),
        isDisabled: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SystemRolePermissionDropdown
                {...props}
            />);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with isDisabledTrue', () => {
        const wrapper = shallow(
            <SystemRolePermissionDropdown
                {...props}
                isDisabled={true}
            />);

        expect(wrapper).toMatchSnapshot();
    });
});
