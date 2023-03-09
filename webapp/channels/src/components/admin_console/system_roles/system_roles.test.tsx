// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

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

        const wrapper = shallow(
            <SystemRoles
                roles={roles}
            />);

        expect(wrapper).toMatchSnapshot();
    });
});
