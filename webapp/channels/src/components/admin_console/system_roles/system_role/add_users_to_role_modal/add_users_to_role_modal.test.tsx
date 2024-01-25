// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import AddUsersToRoleModal from './add_users_to_role_modal';

describe('admin_console/add_users_to_role_modal', () => {
    const baseProps = {
        role: TestHelper.getRoleMock(),
        users: [TestHelper.getUserMock()],
        excludeUsers: {},
        includeUsers: {},
        onAddCallback: jest.fn(),
        onExited: jest.fn(),
        actions: {
            getProfiles: jest.fn(),
            searchProfiles: jest.fn(),
        },
    };

    test('should have single passed value', () => {
        const wrapper = shallowWithIntl(
            <AddUsersToRoleModal
                {...baseProps}
            />);
        expect(wrapper.find('MultiSelect').prop('options')).toHaveLength(1);
        expect(wrapper).toMatchSnapshot();
    });

    test('should exclude user', () => {
        const props = {...baseProps, excludeUsers: {user_id: TestHelper.getUserMock()}};
        const wrapper = shallowWithIntl(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(wrapper.find('MultiSelect').prop('options')).toHaveLength(0);
        expect(wrapper).toMatchSnapshot();
    });

    test('should include additional user', () => {
        const props = {...baseProps, includeUsers: {user_id1: TestHelper.getUserMock()}};
        const wrapper = shallowWithIntl(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(wrapper.find('MultiSelect').prop('options')).toHaveLength(2);
        expect(wrapper).toMatchSnapshot();
    });

    test('should include additional user', () => {
        const props = {...baseProps, includeUsers: {user_id1: TestHelper.getUserMock()}};
        const wrapper = shallowWithIntl(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(wrapper.find('MultiSelect').prop('options')).toHaveLength(2);
        expect(wrapper).toMatchSnapshot();
    });

    test('should not include bot user', () => {
        const botUser = TestHelper.getUserMock();
        botUser.is_bot = true;
        const props = {...baseProps,
            actions: {
                getProfiles: jest.fn().mockResolvedValue({data: [TestHelper.getUserMock(), botUser]}),
                searchProfiles: jest.fn(),
            },
        };
        const wrapper = shallowWithIntl(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(wrapper.find('MultiSelect').prop('options')).toHaveLength(1);
        expect(wrapper).toMatchSnapshot();
    });

    test('search should not include bot user', () => {
        const botUser = TestHelper.getUserMock();
        botUser.is_bot = true;
        const props = {...baseProps,
            actions: {
                searchProfiles: jest.fn().mockResolvedValue({data: [TestHelper.getUserMock(), botUser]}),
                getProfiles: jest.fn(),
            },
        };
        const wrapper = shallowWithIntl(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(wrapper.find('MultiSelect').prop('options')).toHaveLength(1);
        expect(wrapper).toMatchSnapshot();
    });
});
