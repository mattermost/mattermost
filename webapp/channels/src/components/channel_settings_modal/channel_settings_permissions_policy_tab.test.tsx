// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {renderWithContext, screen, waitFor, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsPermissionsPolicyTab from './channel_settings_permissions_policy_tab';

jest.mock('hooks/useChannelAccessControlActions');

// The editor's TableEditor pulls in heavy editor-only dependencies that are
// never rendered in the list view exercised here.
jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    const ReactModule = require('react');
    return jest.fn(() => ReactModule.createElement('div', {'data-testid': 'table-editor'}, 'TableEditor'));
});

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;

describe('components/channel_settings_modal/ChannelSettingsPermissionsPolicyTab', () => {
    const mockActions = {
        getAccessControlFields: jest.fn(),
        getVisualAST: jest.fn(),
        searchUsers: jest.fn(),
        getChannelPolicy: jest.fn(),
        saveChannelPolicy: jest.fn(),
        deleteChannelPolicy: jest.fn(),
        getChannelMembers: jest.fn(),
        createJob: jest.fn(),
        createAccessControlSyncJob: jest.fn(),
        updateAccessControlPoliciesActive: jest.fn(),
        validateExpressionAgainstRequester: jest.fn(),
        simulatePolicyForUsers: jest.fn(),
    };

    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            type: 'P',
        }),
        setAreThereUnsavedChanges: jest.fn(),
        showTabSwitchError: false,
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {id: 'current_user_id', roles: 'channel_user'},
                },
            },
            roles: {roles: {}},
            channels: {},
            teams: {currentTeamId: 'team_id'},
        },
        plugins: {components: {}},
    };

    // A loaded policy mixing the membership rule (filtered out of the list) with
    // one permission rule per role plus one with an unrecognized role to cover
    // the em-dash fallback.
    const policyWithRules = {
        rules: [
            {actions: ['*'], expression: '', role: ''},
            {name: 'Guest uploads', role: 'channel_guest', actions: ['upload_file_attachment'], expression: 'a'},
            {name: 'Member downloads', role: 'channel_user', actions: ['download_file_attachment'], expression: 'b'},
            {name: 'Admin everything', role: 'channel_admin', actions: ['upload_file_attachment', 'download_file_attachment'], expression: 'c'},
            {name: 'Legacy mystery', role: 'unknown_role', actions: ['upload_file_attachment'], expression: 'd'},
        ],
        imports: [],
        active: true,
    } as unknown as AccessControlPolicy;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseChannelAccessControlActions.mockReturnValue(mockActions);
        mockActions.getAccessControlFields.mockResolvedValue({data: []});
        mockActions.getChannelPolicy.mockResolvedValue({data: policyWithRules});
        console.error = jest.fn();
    });

    test('renders Rule name, Role and Permissions column headers', async () => {
        renderWithContext(<ChannelSettingsPermissionsPolicyTab {...baseProps}/>, initialState);

        const table = await screen.findByTestId('permissions-policy-rules-table');
        const headers = within(table).getAllByRole('columnheader');

        expect(headers[0]).toHaveTextContent('Rule name');
        expect(headers[1]).toHaveTextContent('Role');
        expect(headers[2]).toHaveTextContent('Permissions');
    });

    test('maps each rule role to its plural label and em-dash for unknown roles', async () => {
        renderWithContext(<ChannelSettingsPermissionsPolicyTab {...baseProps}/>, initialState);

        await screen.findByText('Guest uploads');

        expect(screen.getByText('Channel guests')).toBeInTheDocument();
        expect(screen.getByText('Channel members')).toBeInTheDocument();
        expect(screen.getByText('Channel admins')).toBeInTheDocument();

        // The rule with an unrecognized role falls back to an em-dash.
        const mysteryRow = screen.getByText('Legacy mystery').closest('tr')!;
        expect(within(mysteryRow).getByText('—')).toBeInTheDocument();
    });

    test('shows a single persistent info notice between heading and search', async () => {
        renderWithContext(<ChannelSettingsPermissionsPolicyTab {...baseProps}/>, initialState);

        const notice = await screen.findByTestId('permissions-policy-notice');
        expect(notice).toHaveTextContent('If several rules cover the same permission, matching any one of them is enough.');
        expect(notice).toHaveTextContent('System and team permission policies may also apply, and these rules can only narrow the access they allow.');
    });

    test('no longer renders the old system banner or overlap hint notices', async () => {
        renderWithContext(<ChannelSettingsPermissionsPolicyTab {...baseProps}/>, initialState);

        await screen.findByTestId('permissions-policy-notice');

        expect(screen.queryByTestId('permissions-policy-system-banner')).not.toBeInTheDocument();
        expect(screen.queryByTestId('permissions-or-hint')).not.toBeInTheDocument();
    });

    test('renders the notice even when there are no rules', async () => {
        mockActions.getChannelPolicy.mockResolvedValue({data: {rules: [], imports: [], active: false} as unknown as AccessControlPolicy});

        renderWithContext(<ChannelSettingsPermissionsPolicyTab {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(screen.getByTestId('permissions-policy-notice')).toBeInTheDocument();
        });
    });
});
