// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor, act, cleanup} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AddUsersToRoleModal from './add_users_to_role_modal';

describe('admin_console/add_users_to_role_modal', () => {
    const defaultUser = TestHelper.getUserMock({
        id: 'user_id',
        username: 'test_user',
        first_name: 'Test',
        last_name: 'User',
    });

    const baseProps = {
        role: TestHelper.getRoleMock({
            id: 'role_id',
            name: 'system_admin',
            display_name: 'System Admin',
        }),
        users: [defaultUser],
        excludeUsers: {},
        includeUsers: {},
        onAddCallback: vi.fn(),
        onExited: vi.fn(),
        actions: {
            getProfiles: vi.fn().mockResolvedValue({data: [defaultUser]}),
            searchProfiles: vi.fn().mockResolvedValue({data: []}),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({shouldAdvanceTime: true});

        // Mock requestAnimationFrame to prevent focus errors on null ref
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
            // Return a dummy id without executing the callback
            return 1;
        });
    });

    afterEach(async () => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        cleanup();
    });

    it('renders the modal with title', async () => {
        await act(async () => {
            renderWithContext(
                <AddUsersToRoleModal {...baseProps}/>,
            );
        });

        expect(screen.getByText(/Add users to/)).toBeInTheDocument();
    });

    it('renders the multiselect search input', async () => {
        await act(async () => {
            renderWithContext(
                <AddUsersToRoleModal {...baseProps}/>,
            );
        });

        const input = document.querySelector('input');
        expect(input).toBeInTheDocument();
    });

    it('calls getProfiles on mount', async () => {
        await act(async () => {
            renderWithContext(
                <AddUsersToRoleModal {...baseProps}/>,
            );
        });

        await waitFor(() => {
            expect(baseProps.actions.getProfiles).toHaveBeenCalled();
        });
    });

    it('renders the add button', async () => {
        await act(async () => {
            renderWithContext(
                <AddUsersToRoleModal {...baseProps}/>,
            );
        });

        expect(screen.getByRole('button', {name: 'Add'})).toBeInTheDocument();
    });

    it('displays remaining people count message', async () => {
        await act(async () => {
            renderWithContext(
                <AddUsersToRoleModal {...baseProps}/>,
            );
        });

        expect(screen.getByText(/You can add/)).toBeInTheDocument();
    });
});
