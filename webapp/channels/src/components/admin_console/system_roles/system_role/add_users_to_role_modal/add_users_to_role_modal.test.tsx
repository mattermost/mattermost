// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AddUsersToRoleModal from './add_users_to_role_modal';

describe('admin_console/add_users_to_role_modal', () => {
    beforeEach(() => {
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

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

    test('should have single passed value', async () => {
        const {baseElement} = await renderWithContext(
            <AddUsersToRoleModal
                {...baseProps}
            />);
        expect(baseElement).toMatchSnapshot();
    });

    test('should exclude user', async () => {
        const props = {...baseProps, excludeUsers: {user_id: TestHelper.getUserMock()}};
        const {baseElement} = await renderWithContext(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(baseElement).toMatchSnapshot();
    });

    test('should include additional user', async () => {
        const props = {...baseProps, includeUsers: {user_id1: TestHelper.getUserMock({id: 'user_id1'})}};
        const {baseElement} = await renderWithContext(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(baseElement).toMatchSnapshot();
    });

    test('should not include bot user', async () => {
        const botUser = TestHelper.getUserMock({is_bot: true});
        const regularUser = TestHelper.getUserMock({id: 'regular_user'});
        const props = {...baseProps, users: [regularUser, botUser]};
        const {baseElement} = await renderWithContext(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(baseElement).toMatchSnapshot();
    });

    test('search should not include bot user', async () => {
        const botUser = TestHelper.getUserMock({is_bot: true});
        const regularUser = TestHelper.getUserMock({id: 'regular_user'});
        const props = {...baseProps, users: [regularUser, botUser]};
        const {baseElement} = await renderWithContext(
            <AddUsersToRoleModal
                {...props}
            />);
        expect(baseElement).toMatchSnapshot();
    });
});
