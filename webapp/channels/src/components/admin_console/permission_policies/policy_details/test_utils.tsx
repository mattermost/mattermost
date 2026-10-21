// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicyProps} from '@mattermost/types/access_control';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {Client4} from 'mattermost-redux/client';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';

import CELEditor from '../../access_control/editors/cel_editor/editor';
import TableEditor from '../../access_control/editors/table_editor/table_editor';

// Importers must jest.mock both editors, both hooks, SimulateAccessModal and
// utils/browser_history themselves; jest.mock does not carry across imports.
export const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;
export const MockedCELEditor = CELEditor as jest.MockedFunction<typeof CELEditor>;
export const mockUseEnabledSessionAttributeFields = useEnabledSessionAttributeFields as jest.MockedFunction<typeof useEnabledSessionAttributeFields>;
const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;

export const E = 'user.attributes.teams == "engineering"';
export const SERVER_PREFIXED_E = `!user.isbot || ${E}`;
export const BOT_C_RETURNED = '!user.isbot || ((user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" &&\nuser.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" &&\nuser.attributes.Program == "Hydra"))';
export const BOT_C_UNWRAPPED = '(user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" &&\nuser.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" &&\nuser.attributes.Program == "Hydra")';
export const BOT_PROPS = {bot_scope: true};

export const mockFetchPolicy = jest.fn();
export const mockCreatePolicy = jest.fn();
const mockGetAccessControlFields = jest.fn();

const SESSION_GROUP_UUID = 'session_attributes';

const makeSessionField = (id: string, name: string): UserPropertyField => ({
    id,
    name,
    type: 'text',
    group_id: SESSION_GROUP_UUID,
    target_id: '',
    target_type: 'system',
    object_type: 'session',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        enabled: true,
    } as UserPropertyField['attrs'],
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

const accessControlSettings: AccessControlSettings = {
    EnableAttributeBasedAccessControl: true,
    EnableUserManagedAttributes: false,
    EnableChannelPolicyIndicators: true,
    TrustProxyDeviceIdentityHeader: false,
    EnforceDeviceIDConsistency: false,
    EnableAccessControlAuditLogging: false,
    SyncJobIntervalSeconds: 3600,
    AttributeRefreshIntervalSeconds: 30,
};

export const baseProps = {
    policyId: 'policy1',
    accessControlSettings,
    sessionAttributesEnabled: true,
    actions: {
        fetchPolicy: mockFetchPolicy,
        createPolicy: mockCreatePolicy,
        deletePolicy: jest.fn(),
        setNavigationBlocked: jest.fn(),
    },
};

export function setUpPolicyDetailsMocks(): jest.SpyInstance {
    mockFetchPolicy.mockReset();
    mockGetAccessControlFields.mockReset();
    mockCreatePolicy.mockReset();
    const checkExpressionSpy = jest.spyOn(Client4, 'checkAccessControlExpression').mockResolvedValue([]);

    mockFetchPolicy.mockResolvedValue({
        data: {
            id: 'policy1',
            name: 'Policy 1',
            roles: ['system_user'],
            rules: [],
        },
    });

    mockUseEnabledSessionAttributeFields.mockReturnValue([makeSessionField('s1', 'network_name')]);
    mockUseChannelAccessControlActions.mockReturnValue({
        getAccessControlFields: mockGetAccessControlFields,
        getVisualAST: jest.fn(),
        searchUsers: jest.fn(),
        getChannelPolicy: jest.fn(),
        saveChannelPolicy: jest.fn(),
        deleteChannelPolicy: jest.fn(),
        getChannelMembers: jest.fn(),
        createJob: jest.fn(),
        createAccessControlSyncJob: jest.fn(),
        validateExpressionAgainstRequester: jest.fn(),
        simulatePolicyForUsers: jest.fn(),
        updateAccessControlPoliciesActive: jest.fn(),
    });

    // One LDAP-synced attribute keeps the editor usable so the mode toggle
    // is enabled and reflects the loaded expression rather than the
    // no-attributes gate.
    mockGetAccessControlFields.mockResolvedValue({
        data: [
            {id: 'u1', name: 'teams', attrs: {ldap: 'teams'}},
            {id: 'u2', name: 'department', group_id: 'custom_profile_attributes', object_type: 'user', attrs: {managed: 'admin'}},
        ],
    });

    return checkExpressionSpy;
}

export const renderWithExpression = (expression: string) => {
    mockFetchPolicy.mockResolvedValue({
        data: {
            id: 'policy1',
            name: 'Policy 1',
            roles: ['system_user'],
            rules: expression ? [{actions: ['download_file_attachment'], expression}] : [],
        },
    });
    return renderWithContext(<PermissionPolicyDetails {...baseProps}/>);
};

export const renderWithPolicy = (policy: {roles?: string[]; expressions: string[]; props?: AccessControlPolicyProps}, initialState = {}) => {
    mockFetchPolicy.mockResolvedValue({
        data: {
            id: 'policy1',
            name: 'Policy 1',
            type: 'permission',
            roles: policy.roles ?? ['system_user'],
            props: policy.props,
            rules: policy.expressions.map((expression) => ({actions: ['download_file_attachment'], expression})),
        },
    });
    return renderWithContext(<PermissionPolicyDetails {...baseProps}/>, initialState);
};

export const renderBotPolicy = (expressions: string[], initialState = {}) => renderWithPolicy({expressions, props: BOT_PROPS}, initialState);

export const lastTableProps = () => MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
export const lastCELProps = () => MockedCELEditor.mock.calls[MockedCELEditor.mock.calls.length - 1][0];

export const selectorText = () => document.querySelector('#pp-role-selector-btn')!.textContent;

// Menu items run their onClick only after the menu's close transition.
export const chooseMenuItem = async (buttonId: string, menuId: string, optionId: string) => {
    await userEvent.click(document.querySelector(`#${buttonId}`)!);
    await userEvent.click(document.querySelector(`#${optionId}`)!);
    await waitFor(() => expect(document.querySelector(`#${menuId}`)).not.toBeInTheDocument());
};

export const selectScope = (optionId: string) => chooseMenuItem('pp-role-selector-btn', 'pp-role-selector-menu', optionId);

export const switchToAdvanced = async () => {
    await userEvent.click(screen.getByText('Switch to Advanced Mode'));
    await screen.findByTestId('cel-editor');
};

const nativeField = (name: string, displayName: string): UserPropertyField => ({
    id: `native_user_attribute_${name}`,
    name,
    type: 'text',
    group_id: 'custom_profile_attributes',
    target_id: '',
    target_type: 'system',
    object_type: 'user',
    attrs: {sort_order: 0, visibility: 'always', value_type: '', native: true, display_name: displayName},
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
} as UserPropertyField);

export const customField = (id: string, name: string, attrs: Partial<UserPropertyField['attrs']>): UserPropertyField => ({
    ...nativeField(name, ''),
    id,
    attrs: {sort_order: 0, visibility: 'always', value_type: '', ...attrs},
} as UserPropertyField);

export const NATIVE_FIELDS = [
    nativeField('email', 'Email'),
    nativeField('verified', 'Email verified'),
    nativeField('isbot', 'Bot account'),
    nativeField('createat', 'Account created'),
];
export const LDAP_TEAMS = customField('u-teams', 'teams', {ldap: 'memberOf'});

export const useFields = (fields: UserPropertyField[]) => mockGetAccessControlFields.mockResolvedValue({data: fields});
