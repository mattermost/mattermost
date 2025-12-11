// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRoleUsers from './system_role_users';

describe('admin_console/system_role_users', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
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
        onAddCallback: vi.fn(),
        onRemoveCallback: vi.fn(),
        actions: {
            getFilteredUsersStats: vi.fn(),
            getProfiles: vi.fn(),
            searchProfiles: vi.fn(),
            setUserGridSearch: vi.fn(),
        },
        readOnly: false,
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <SystemRoleUsers
                {...props}
            />,
        );

        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with readOnly true', async () => {
        const {container} = renderWithContext(
            <SystemRoleUsers
                {...props}
                readOnly={true}
            />,
        );

        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
