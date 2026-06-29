// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
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
        const {baseElement} = renderWithContext(
            <AddUsersToRoleModal
                {...baseProps}
            />);
        expect(baseElement).toMatchSnapshot();
    });

    test('should exclude user', () => {
        const props = {...baseProps, excludeUsers: {user_id: TestHelper.getUserMock()}};
        const {baseElement} = renderWithContext(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(baseElement).toMatchSnapshot();
    });

    test('should include additional user', () => {
        const props = {...baseProps, includeUsers: {user_id1: TestHelper.getUserMock()}};
        const {baseElement} = renderWithContext(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(baseElement).toMatchSnapshot();
    });

    test('should not include bot user', () => {
        const botUser = TestHelper.getUserMock({is_bot: true});
        const regularUser = TestHelper.getUserMock({id: 'regular_user'});
        const props = {...baseProps, users: [regularUser, botUser]};
        const {baseElement} = renderWithContext(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(baseElement).toMatchSnapshot();
    });

    test('search should not include bot user', () => {
        const botUser = TestHelper.getUserMock({is_bot: true});
        const regularUser = TestHelper.getUserMock({id: 'regular_user'});
        const props = {...baseProps, users: [regularUser, botUser]};
        const {baseElement} = renderWithContext(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(baseElement).toMatchSnapshot();
    });
});
