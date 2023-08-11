// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import AddUsersToRoleModal from './add_users_to_role_modal';

describe('admin_console/add_users_to_role_modal', () => {
    const props = {
        role: TestHelper.getRoleMock(),
        users: [TestHelper.getUserMock()],
        excludeUsers: {
            asdf123: TestHelper.getUserMock(),
        },
        includeUsers: {
            asdf123: TestHelper.getUserMock(),
        },
        onAddCallback: jest.fn(),
        onExited: jest.fn(),
        actions: {
            getProfiles: jest.fn(),
            searchProfiles: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AddUsersToRoleModal
                {...props}
            />);

        expect(wrapper).toMatchSnapshot();
    });
});
