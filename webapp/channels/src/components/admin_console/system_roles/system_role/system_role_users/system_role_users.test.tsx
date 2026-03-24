// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRoleUsers from './system_role_users';

describe('admin_console/system_role_users', () => {
    const getBaseProps = () => ({
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
            getFilteredUsersStats: jest.fn().mockResolvedValue({data: {}}),
            getProfiles: jest.fn().mockResolvedValue({data: []}),
            searchProfiles: jest.fn().mockResolvedValue({data: []}),
            setUserGridSearch: jest.fn(),
        },
        readOnly: false,
    });

    test('should match snapshot', async () => {
        const props = getBaseProps();
        const {container} = renderWithContext(
            <SystemRoleUsers
                {...props}
            />,
        );

        await waitFor(() => {
            expect(props.actions.getProfiles).toHaveBeenCalledTimes(1);
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with readOnly true', async () => {
        const props = getBaseProps();
        const {container} = renderWithContext(
            <SystemRoleUsers
                {...props}
                readOnly={true}
            />,
        );

        await waitFor(() => {
            expect(props.actions.getProfiles).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByRole('button', {name: 'Add People'})).toBeDisabled();
        expect(container).toMatchSnapshot();
    });
});
