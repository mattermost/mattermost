// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';
import type {PermissionPolicyDetailsProps} from './permission_policy_details';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: jest.fn(), listen: jest.fn(), location: {pathname: ''}}),
}));

jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: () => ({
        getAccessControlFields: jest.fn().mockResolvedValue({data: []}),
        getVisualAST: jest.fn().mockResolvedValue({data: {conditions: []}}),
    }),
}));

describe('PermissionPolicyDetails', () => {
    const defaultProps: PermissionPolicyDetailsProps = {
        accessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: false,
        },
        actions: {
            fetchPolicy: jest.fn().mockResolvedValue({data: {}} as ActionResult),
            createPolicy: jest.fn().mockResolvedValue({data: {}} as ActionResult),
            deletePolicy: jest.fn().mockResolvedValue({data: {}} as ActionResult),
            setNavigationBlocked: jest.fn(),
        },
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should render the permissions card with add permission button', async () => {
        renderWithContext(<PermissionPolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Permissions')).toBeInTheDocument();
        });

        expect(screen.getByText('Add permission')).toBeInTheDocument();
    });

    test('should show empty state when no permissions are selected', async () => {
        renderWithContext(<PermissionPolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Add a permission to this policy')).toBeInTheDocument();
        });
    });

    test('should show grouped permissions in the add menu', async () => {
        renderWithContext(<PermissionPolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Add permission')).toBeInTheDocument();
        });

        const addButton = screen.getByText('Add permission');
        await userEvent.click(addButton);

        // Verify group headers are shown
        await waitFor(() => {
            expect(screen.getByText('File Permissions')).toBeInTheDocument();
            expect(screen.getByText('Post Permissions')).toBeInTheDocument();
        });

        // Verify all permission options are available
        expect(screen.getByText('Download Files')).toBeInTheDocument();
        expect(screen.getByText('Upload Files')).toBeInTheDocument();
        expect(screen.getByText('Edit Posts')).toBeInTheDocument();
        expect(screen.getByText('Create Burn-on-Read Posts')).toBeInTheDocument();
    });

    test('should add and display a post permission', async () => {
        renderWithContext(<PermissionPolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Add permission')).toBeInTheDocument();
        });

        const addButton = screen.getByText('Add permission');
        await userEvent.click(addButton);

        // Click on "Edit Posts" option
        await waitFor(() => {
            expect(screen.getByText('Edit Posts')).toBeInTheDocument();
        });

        const editPostItem = screen.getByText('Edit Posts');
        await userEvent.click(editPostItem);

        // The permission should now appear in the table
        const rows = document.querySelectorAll('.pp-permissions-table-row');
        expect(rows.length).toBe(1);
        expect(rows[0]).toHaveTextContent('Edit Posts');
    });

    test('should remove a permission when trash icon is clicked', async () => {
        renderWithContext(<PermissionPolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Add permission')).toBeInTheDocument();
        });

        // Add a permission first
        const addButton = screen.getByText('Add permission');
        await userEvent.click(addButton);

        await waitFor(() => {
            expect(screen.getByText('Download Files')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('Download Files'));

        // Verify it was added
        let rows = document.querySelectorAll('.pp-permissions-table-row');
        expect(rows.length).toBe(1);

        // Click the remove button
        const removeButton = screen.getByLabelText('Remove permission');
        await userEvent.click(removeButton);

        // Verify it was removed
        rows = document.querySelectorAll('.pp-permissions-table-row');
        expect(rows.length).toBe(0);
        expect(screen.getByText('Add a permission to this policy')).toBeInTheDocument();
    });

    test('should render role selector', async () => {
        renderWithContext(<PermissionPolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Select a role')).toBeInTheDocument();
        });
    });
});
