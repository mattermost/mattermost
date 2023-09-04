// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import SystemRoleUsers from './system_role_users';

describe('admin_console/system_role_users', () => {
    const props = {
        users: [TestHelper.getUserMock()],
        role: TestHelper.getRoleMock(),
        totalCount: 5,
        term: 'asdfasdf',
        currentUserId: '123123',
        usersToRemove: {
            userToRemove: TestHelper.getUserMock(),
        },
        usersToAdd: {
            userToAdd: TestHelper.getUserMock(),
        },
        onAddCallback: jest.fn(),
        onRemoveCallback: jest.fn(),
        actions: {
            getFilteredUsersStats: jest.fn(),
            getProfiles: jest.fn(),
            searchProfiles: jest.fn(),
            setUserGridSearch: jest.fn(),
        },
        readOnly: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SystemRoleUsers
                {...props}
            />);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with readOnly true', () => {
        const wrapper = shallow(
            <SystemRoleUsers
                {...props}
                readOnly={true}
            />);

        expect(wrapper).toMatchSnapshot();
    });
});
