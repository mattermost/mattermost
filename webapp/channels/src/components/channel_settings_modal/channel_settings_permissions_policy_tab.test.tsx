// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    ACCESS_CONTROL_ACTION_DOWNLOAD_FILE,
    ACCESS_CONTROL_ACTION_UPLOAD_FILE,
    ACCESS_CONTROL_CHANNEL_ROLE_ADMIN,
    ACCESS_CONTROL_CHANNEL_ROLE_USER,
} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useChannelSystemPolicies} from 'hooks/useChannelSystemPolicies';
import {act, renderWithContext, screen, waitFor, within, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsPermissionsPolicyTab from './channel_settings_permissions_policy_tab';

jest.mock('hooks/useChannelAccessControlActions');
jest.mock('hooks/useChannelSystemPolicies');

// TableEditor renders the "User attribute conditions" expression. The mock
// exposes the current `value` so the test can assert the expression survives a
// failed save, and the `onChange` prop is used (via mock.calls) to populate it.
jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    const React = require('react'); // eslint-disable-line @typescript-eslint/no-shadow, global-require
    return jest.fn((props: {value: string}) => React.createElement(
        'div',
        {'data-testid': 'table-editor'},
        React.createElement('span', {'data-testid': 'table-editor-value'}, props.value),
    ));
});

// Render the dropdown menus inline so their items can be clicked directly.
jest.mock('components/menu', () => {
    const React = require('react'); // eslint-disable-line @typescript-eslint/no-shadow, global-require
    return {
        Container: ({children, menuButton}: any) => {
            const {class: className, dataTestId, children: btnChildren, ...rest} = menuButton || {};
            return React.createElement(
                'div',
                null,
                React.createElement('button', {className, 'data-testid': dataTestId, ...rest}, btnChildren),
                children,
            );
        },
        Item: ({id, onClick, labels}: any) => React.createElement('button', {'data-testid': id, onClick}, labels),
    };
});

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const mockUseChannelSystemPolicies = useChannelSystemPolicies as jest.MockedFunction<typeof useChannelSystemPolicies>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;

const EXPRESSION = 'user.attributes.department == "Engineering"';

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

    const mockUserAttributes: UserPropertyField[] = [
        {
            id: 'attr1',
            name: 'department',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            update_at: 1736541716295,
            delete_at: 0,
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
                options: [
                    {id: 'eng', name: 'Engineering'},
                    {id: 'sales', name: 'Sales'},
                ],
            },
        } as unknown as UserPropertyField,
    ];

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
                    current_user_id: TestHelper.getUserMock({id: 'current_user_id', roles: 'system_admin'}),
                },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseChannelAccessControlActions.mockReturnValue(mockActions);
        mockUseChannelSystemPolicies.mockReturnValue({policies: [], loading: false, error: null});
        mockActions.getAccessControlFields.mockResolvedValue({data: mockUserAttributes});

        // No existing policy: exercise the first-time-create path.
        mockActions.getChannelPolicy.mockResolvedValue({error: {status_code: 404}});
        mockActions.saveChannelPolicy.mockResolvedValue({data: {rules: []}});

        console.error = jest.fn();
        console.warn = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const latestTableEditorProps = () => {
        const {calls} = MockedTableEditor.mock;
        return calls[calls.length - 1][0];
    };

    const openNewRuleEditor = async () => {
        renderWithContext(<ChannelSettingsPermissionsPolicyTab {...baseProps}/>, initialState);

        const addRuleButton = await screen.findByTestId('permissions-policy-add-rule');
        await waitFor(() => expect(addRuleButton).toBeEnabled());
        await userEvent.click(addRuleButton);

        await screen.findByTestId('permissions-policy-editor');
    };

    const openNewRuleEditorWithFields = async () => {
        await openNewRuleEditor();
        await screen.findByTestId('table-editor');

        // Populate the expression via TableEditor's onChange.
        act(() => {
            latestTableEditorProps().onChange(EXPRESSION);
        });

        // Switch the role away from the default and add both file permissions so
        // every field carries a non-default value.
        await userEvent.click(screen.getByTestId(`cpp-role-option-${ACCESS_CONTROL_CHANNEL_ROLE_ADMIN}`));
        await userEvent.click(screen.getByTestId(`cpp-add-permission-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`));
        await userEvent.click(screen.getByTestId(`cpp-add-permission-${ACCESS_CONTROL_ACTION_DOWNLOAD_FILE}`));
    };

    test('new rule starts with no permissions selected', async () => {
        await openNewRuleEditor();

        // The permissions table must start empty rather than pre-selecting a
        // permission (regression guard for MM-69505 where "Upload files" was
        // selected by default).
        expect(screen.getByText('Add a permission to this rule')).toBeInTheDocument();
        expect(screen.queryByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).not.toBeInTheDocument();
    });

    test('new rule offers both file permissions to add since none are pre-selected', async () => {
        await openNewRuleEditor();

        await userEvent.click(await screen.findByTestId('permissions-policy-editor-add-permission'));

        // Assert on the option descriptions, which only render inside the
        // "Add permission" dropdown (the selected-permission table rows show
        // the label alone). This keeps the assertion a true guard: if upload
        // were pre-selected again, it would drop out of the dropdown here.
        expect(await screen.findByText('Allow users to attach files to messages in this channel')).toBeInTheDocument();
        expect(screen.getByText('Allow users to download attached files from this channel')).toBeInTheDocument();
    });

    test('a new rule with no permissions selected fails validation on save', async () => {
        await openNewRuleEditor();

        await userEvent.type(await screen.findByTestId('permissions-policy-editor-name'), 'My rule');
        await userEvent.click(screen.getByTestId('permissions-policy-editor-save'));

        // The empty default now makes the "at least one permission" rule
        // reachable for brand-new rules; saving without one is rejected.
        expect(await screen.findByTestId('permissions-policy-editor-error')).toHaveTextContent('Select at least one permission action for each rule.');
    });

    test('adding the upload permission shows it in the rule', async () => {
        await openNewRuleEditor();

        await userEvent.click(await screen.findByTestId('permissions-policy-editor-add-permission'));
        await userEvent.click(screen.getByTestId(`cpp-add-permission-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`));

        expect(await screen.findByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).toBeInTheDocument();
    });

    test('preserves all field values when saving a new rule with an empty name', async () => {
        await openNewRuleEditorWithFields();

        // Sanity: the form is fully populated before saving.
        expect(screen.getByTestId('table-editor-value')).toHaveTextContent(EXPRESSION);
        expect(within(screen.getByTestId('permissions-policy-editor-role')).getByText('Channel admin')).toBeInTheDocument();
        expect(screen.getByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).toBeInTheDocument();
        expect(screen.getByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_DOWNLOAD_FILE}`)).toBeInTheDocument();

        // Save with the Name field left empty.
        await userEvent.click(screen.getByTestId('permissions-policy-editor-save'));

        // The validation error is surfaced...
        expect(await screen.findByTestId('permissions-policy-editor-error')).toHaveTextContent('Each permission rule needs a unique name.');

        // ...and the editor stays open with every previously entered value intact.
        expect(screen.getByTestId('permissions-policy-editor')).toBeInTheDocument();
        expect(screen.getByTestId('table-editor-value')).toHaveTextContent(EXPRESSION);
        expect(within(screen.getByTestId('permissions-policy-editor-role')).getByText('Channel admin')).toBeInTheDocument();
        expect(screen.getByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).toBeInTheDocument();
        expect(screen.getByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_DOWNLOAD_FILE}`)).toBeInTheDocument();

        // Nothing was persisted because the rule never validated.
        expect(mockActions.saveChannelPolicy).not.toHaveBeenCalled();
    });

    test('commits the rule to the list once a name is provided', async () => {
        await openNewRuleEditorWithFields();

        await userEvent.type(screen.getByTestId('permissions-policy-editor-name'), 'Block uploads');
        await userEvent.click(screen.getByTestId('permissions-policy-editor-save'));

        // The editor closes and the new rule appears in the list with both permissions.
        expect(await screen.findByText('Block uploads')).toBeInTheDocument();
        expect(screen.getByText('2 permissions')).toBeInTheDocument();
        expect(screen.queryByTestId('permissions-policy-editor')).not.toBeInTheDocument();
    });

    test('reseeds defaults when the new-rule editor is reopened after cancel', async () => {
        await openNewRuleEditorWithFields();

        // Abandon the half-filled draft.
        await userEvent.click(screen.getByTestId('permissions-policy-editor-cancel'));

        // Reopen the new-rule editor.
        await userEvent.click(await screen.findByTestId('permissions-policy-add-rule'));
        await screen.findByTestId('table-editor');

        // A fresh editor shows defaults, not the abandoned draft.
        expect(screen.getByTestId('table-editor-value')).toBeEmptyDOMElement();
        expect(within(screen.getByTestId('permissions-policy-editor-role')).getByText('Channel member')).toBeInTheDocument();
        expect(screen.getByText('Add a permission to this rule')).toBeInTheDocument();
        expect(screen.queryByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).not.toBeInTheDocument();
        expect(screen.queryByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_DOWNLOAD_FILE}`)).not.toBeInTheDocument();
    });

    test('preserves in-progress edits to an existing rule when validation fails', async () => {
        // Seed an existing permission rule so the non-404 load branch and the
        // edit path are exercised.
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

        renderWithContext(<ChannelSettingsPermissionsPolicyTab {...baseProps}/>, initialState);

        // Open the existing rule from the list.
        await userEvent.click(await screen.findByText('Existing rule'));
        await screen.findByTestId('table-editor');

        // Make an in-progress edit, then clear the name to fail validation.
        const newExpression = 'user.attributes.team == "ops"';
        act(() => {
            latestTableEditorProps().onChange(newExpression);
        });
        await userEvent.clear(screen.getByTestId('permissions-policy-editor-name'));
        await userEvent.click(screen.getByTestId('permissions-policy-editor-save'));

        // Error surfaces, editor stays open, and the in-progress edit survives.
        expect(await screen.findByTestId('permissions-policy-editor-error')).toHaveTextContent('Each permission rule needs a unique name.');
        expect(screen.getByTestId('permissions-policy-editor')).toBeInTheDocument();
        expect(screen.getByTestId('table-editor-value')).toHaveTextContent(newExpression);
        expect(screen.getByTestId(`permissions-policy-editor-action-${ACCESS_CONTROL_ACTION_UPLOAD_FILE}`)).toBeInTheDocument();
    });
});
