// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import PermissionPolicyList from './permission_policies';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: jest.fn(), listen: jest.fn(), location: {pathname: ''}}),
}));

describe('PermissionPolicyList', () => {
    const mockSearchPolicies = jest.fn();
    const mockDeletePolicy = jest.fn();
    const defaultProps = {
        actions: {
            searchPolicies: mockSearchPolicies,
            deletePolicy: mockDeletePolicy,
        },
    };

    beforeEach(() => {
        mockSearchPolicies.mockReset();
        mockDeletePolicy.mockReset();
    });

    test('should render with title and description', async () => {
        mockSearchPolicies.mockResolvedValue({data: {policies: [], total: 0}} as ActionResult);
        renderWithContext(<PermissionPolicyList {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Permission Policies')).toBeInTheDocument();
        });
        expect(screen.getByText('Create policies to control file upload and download permissions based on user attributes.')).toBeInTheDocument();
    });

    test('should display file action labels correctly', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'p1',
                    name: 'File Policy',
                    roles: ['system_user'],
                    rules: [{actions: ['download_file_attachment', 'upload_file_attachment'], expression: 'true'}],
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);

        renderWithContext(<PermissionPolicyList {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('File Policy')).toBeInTheDocument();
        });

        expect(screen.getByText('Download Files, Upload Files')).toBeInTheDocument();
    });

    test('should display post action labels correctly', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'p2',
                    name: 'Post Policy',
                    roles: ['system_user'],
                    rules: [{actions: ['edit_post', 'create_burn_on_read'], expression: 'true'}],
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);

        renderWithContext(<PermissionPolicyList {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Post Policy')).toBeInTheDocument();
        });

        expect(screen.getByText('Edit Posts, Create Burn-on-Read Posts')).toBeInTheDocument();
    });

    test('should display mixed action labels correctly', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'p3',
                    name: 'Mixed Policy',
                    roles: ['system_admin'],
                    rules: [{actions: ['download_file_attachment', 'edit_post'], expression: 'true'}],
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);

        renderWithContext(<PermissionPolicyList {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Mixed Policy')).toBeInTheDocument();
        });

        expect(screen.getByText('Download Files, Edit Posts')).toBeInTheDocument();
    });

    test('should show empty state when no policies exist', async () => {
        mockSearchPolicies.mockResolvedValue({data: {policies: [], total: 0}} as ActionResult);
        renderWithContext(<PermissionPolicyList {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('No permission policies found')).toBeInTheDocument();
        });
    });
});
