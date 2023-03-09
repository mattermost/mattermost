// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import SystemRole from './system_role';

describe('admin_console/system_role', () => {
    const props = {
        role: TestHelper.getRoleMock(),
        isDisabled: false,
        isLicensedForCloud: false,
        actions: {
            editRole: jest.fn(),
            updateUserRoles: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SystemRole
                {...props}
            />);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with isLicensedForCloud = true', () => {
        const wrapper = shallow(
            <SystemRole
                {...props}
                isLicensedForCloud={true}
            />);

        expect(wrapper).toMatchSnapshot();
    });
});
