// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    ACCESS_CONTROL_ACTION_UPLOAD_FILE,
    ACCESS_CONTROL_CHANNEL_ROLE_USER,
} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useChannelSystemPolicies} from 'hooks/useChannelSystemPolicies';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsPermissionsPolicyTab from './channel_settings_permissions_policy_tab';

jest.mock('hooks/useChannelAccessControlActions');
jest.mock('hooks/useChannelSystemPolicies');

// TableEditor renders the attribute-expression builder, which is irrelevant
// to the permission-selection behavior under test and pulls in heavy deps.
jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    const React = require('react');
    return jest.fn(() => React.createElement('div', {'data-testid': 'table-editor'}, 'TableEditor'));
});

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const mockUseChannelSystemPolicies = useChannelSystemPolicies as jest.MockedFunction<typeof useChannelSystemPolicies>;

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

    const mockUserAttributes: UserPropertyField[] = [];

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
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        username: 'testuser',
                        roles: 'system_admin',
                    },
                },
            },
            roles: {
                roles: {},
            },
            channels: {
                myMembers: {},
            },
            teams: {
                currentTeamId: 'team_id',
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseChannelAccessControlActions.mockReturnValue(mockActions);
        mockUseChannelSystemPolicies.mockReturnValue({
            policies: [],
            loading: false,
            error: null,
        });
        mockActions.getAccessControlFields.mockResolvedValue({data: mockUserAttributes});

        // No existing policy: the tab seeds an empty rule list (first-time create).
        mockActions.getChannelPolicy.mockResolvedValue({data: {rules: []}});
        mockActions.saveChannelPolicy.mockResolvedValue({data: {success: true}});
    });

    test('new rule starts with no permissions selected', async () => {
        renderWithContext(
            <ChannelSettingsPermissionsPolicyTab {...baseProps}/>,
            initialState,
        );

        const addRuleButton = await screen.findByTestId('permissions-policy-add-rule');
        await waitFor(() => expect(addRuleButton).toBeEnabled());

        await userEvent.click(addRuleButton);

        // Editor opens for a brand-new rule.
        expect(await screen.findByTestId('permissions-policy-editor')).toBeInTheDocument();

        // The permissions table must start empty rather than pre-selecting a
        // permission (regression guard for MM-69505 where "Upload files" was
        // selected by default).
        expect(screen.getByText('Add a permission to this rule')).toBeInTheDocument();
        expect(screen.queryByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).not.toBeInTheDocument();
    });

    test('new rule offers both file permissions to add since none are pre-selected', async () => {
        renderWithContext(
            <ChannelSettingsPermissionsPolicyTab {...baseProps}/>,
            initialState,
        );

        const addRuleButton = await screen.findByTestId('permissions-policy-add-rule');
        await waitFor(() => expect(addRuleButton).toBeEnabled());
        await userEvent.click(addRuleButton);

        await userEvent.click(await screen.findByTestId('permissions-policy-editor-add-permission'));

        expect(await screen.findByText('Upload files')).toBeInTheDocument();
        expect(screen.getByText('Download files')).toBeInTheDocument();
    });

    test('adding then the upload permission shows it in the rule', async () => {
        renderWithContext(
            <ChannelSettingsPermissionsPolicyTab {...baseProps}/>,
            initialState,
        );

        const addRuleButton = await screen.findByTestId('permissions-policy-add-rule');
        await waitFor(() => expect(addRuleButton).toBeEnabled());
        await userEvent.click(addRuleButton);

        await userEvent.click(await screen.findByTestId('permissions-policy-editor-add-permission'));
        await userEvent.click(await screen.findByText('Upload files'));

        expect(await screen.findByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).toBeInTheDocument();
    });

    test('editing an existing rule preserves its selected permissions', async () => {
        mockActions.getChannelPolicy.mockResolvedValue({
            data: {
                rules: [{
                    name: 'Existing rule',
                    role: ACCESS_CONTROL_CHANNEL_ROLE_USER,
                    actions: [ACCESS_CONTROL_ACTION_UPLOAD_FILE],
                    expression: 'user.attributes.team == "eng"',
                }],
            },
        });

        renderWithContext(
            <ChannelSettingsPermissionsPolicyTab {...baseProps}/>,
            initialState,
        );

        await userEvent.click(await screen.findByText('Existing rule'));

        expect(await screen.findByTestId('permissions-policy-editor')).toBeInTheDocument();
        expect(screen.getByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).toBeInTheDocument();
    });
});
