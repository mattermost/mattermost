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

jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: () => ({
        getAccessControlFields: jest.fn().mockResolvedValue({data: []}),
        getVisualAST: jest.fn().mockResolvedValue({data: {conditions: []}}),
        createAccessControlSyncJob: jest.fn().mockResolvedValue({data: {}}),
    }),
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

    test('should render sub-tabs and default to Team Policy view', () => {
        renderWithContext(<TeamAccessPoliciesTab {...defaultProps}/>);

        expect(screen.getByText('Team Policy')).toBeInTheDocument();
        expect(screen.getByText('Channel Policies')).toBeInTheDocument();

        // Team Policy tab is active by default
        expect(screen.getByText('Team membership policy')).toBeInTheDocument();
        expect(screen.getByText('Define which users should be members of this team based on their attributes.')).toBeInTheDocument();
    });

    test('should call fetchPolicy with team.id on mount', async () => {
        const fetchPolicy = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...defaultProps,
            actions: {...defaultProps.actions, fetchPolicy},
        };

        renderWithContext(<TeamAccessPoliciesTab {...props}/>);

        await waitFor(() => {
            expect(fetchPolicy).toHaveBeenCalledWith('team_id', undefined, 'team_id');
        });
    });

    test('should show auto-sync toggle disabled when no expression is set', () => {
        renderWithContext(<TeamAccessPoliciesTab {...defaultProps}/>);

        const toggle = screen.getByTestId('teamPolicyAutoSyncToggle-button');
        expect(toggle).toBeInTheDocument();
        expect(toggle).toBeDisabled();
    });

    test('should have correct accessibility attributes', () => {
        renderWithContext(<TeamAccessPoliciesTab {...defaultProps}/>);

        const tabPanel = document.getElementById('accessPoliciesSettings');
        expect(tabPanel).toBeInTheDocument();
        expect(tabPanel).toHaveAttribute('role', 'tabpanel');
        expect(tabPanel).toHaveAttribute('aria-labelledby', 'access_policiesButton');
    });

    test('should show auto-add members label', () => {
        renderWithContext(<TeamAccessPoliciesTab {...defaultProps}/>);

        expect(screen.getByText('Auto-add members based on rules')).toBeInTheDocument();
    });
});
