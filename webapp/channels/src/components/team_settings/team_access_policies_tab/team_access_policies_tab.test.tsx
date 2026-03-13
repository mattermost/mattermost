// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamAccessPoliciesTab from './team_access_policies_tab';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: jest.fn(), listen: jest.fn(), location: {pathname: ''}}),
}));

describe('TeamAccessPoliciesTab', () => {
    const team = TestHelper.getTeamMock({id: 'team_id', display_name: 'Test Team'});

    const defaultProps: ComponentProps<typeof TeamAccessPoliciesTab> = {
        team,
        accessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: false,
        },
        areThereUnsavedChanges: false,
        setAreThereUnsavedChanges: jest.fn(),
        showTabSwitchError: false,
        setShowTabSwitchError: jest.fn(),
        actions: {
            searchTeamPolicies: jest.fn().mockResolvedValue({data: {policies: [], total: 0}}),
            fetchPolicy: jest.fn().mockResolvedValue({data: {}}),
            createPolicy: jest.fn().mockResolvedValue({data: {}}),
            deletePolicy: jest.fn().mockResolvedValue({data: {}}),
            searchChannels: jest.fn().mockResolvedValue({data: {}}),
            assignChannelsToAccessControlPolicy: jest.fn().mockResolvedValue({data: {}}),
            unassignChannelsFromAccessControlPolicy: jest.fn().mockResolvedValue({data: {}}),
            createJob: jest.fn().mockResolvedValue({data: {}}),
            updateAccessControlPoliciesActive: jest.fn().mockResolvedValue({data: {}}),
        },
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should call searchTeamPolicies with team.id on mount', async () => {
        const searchTeamPolicies = jest.fn().mockResolvedValue({data: {policies: [], total: 0}});
        const props = {
            ...defaultProps,
            actions: {...defaultProps.actions, searchTeamPolicies},
        };

        renderWithContext(<TeamAccessPoliciesTab {...props}/>);

        await waitFor(() => {
            expect(searchTeamPolicies).toHaveBeenCalledWith(
                'team_id',
                '',
                'parent',
                '',
                11,
            );
        });
    });

    test('should show empty state when no policies exist', async () => {
        renderWithContext(<TeamAccessPoliciesTab {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('No policies found')).toBeInTheDocument();
        });
    });

    test('should render policy list with names and channel counts', async () => {
        const policies = [
            {id: 'p1', name: 'Engineering Policy', type: 'parent', rules: [{expression: 'true', actions: ['*']}], props: {child_ids: ['ch1', 'ch2', 'ch3']}},
            {id: 'p2', name: 'Sales Policy', type: 'parent', rules: [{expression: 'true', actions: ['*']}], props: {child_ids: ['ch4']}},
        ];

        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                searchTeamPolicies: jest.fn().mockResolvedValue({data: {policies, total: 2}}),
            },
        };

        renderWithContext(<TeamAccessPoliciesTab {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        });

        expect(screen.getByText('Sales Policy')).toBeInTheDocument();
        expect(screen.getByText(/3 channels/)).toBeInTheDocument();
        expect(screen.getByText(/1 channel/)).toBeInTheDocument();
    });

    test('should render policy with no child_ids showing None', async () => {
        const policies = [
            {id: 'p1', name: 'Empty Policy', type: 'parent', rules: [{expression: 'true', actions: ['*']}]},
        ];

        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                searchTeamPolicies: jest.fn().mockResolvedValue({data: {policies, total: 1}}),
            },
        };

        renderWithContext(<TeamAccessPoliciesTab {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Empty Policy')).toBeInTheDocument();
        });

        expect(screen.getByText('None')).toBeInTheDocument();
    });

    test('should have correct accessibility attributes', async () => {
        renderWithContext(<TeamAccessPoliciesTab {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('No policies found')).toBeInTheDocument();
        });

        const tabPanel = document.getElementById('accessPoliciesSettings');
        expect(tabPanel).toBeInTheDocument();
        expect(tabPanel).toHaveAttribute('role', 'tabpanel');
        expect(tabPanel).toHaveAttribute('aria-labelledby', 'access_policiesButton');
    });

    test('should show error state when API call throws', async () => {
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                searchTeamPolicies: jest.fn().mockRejectedValue(new Error('network error')),
            },
        };

        renderWithContext(<TeamAccessPoliciesTab {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Something went wrong. Try again')).toBeInTheDocument();
        });
    });
});
