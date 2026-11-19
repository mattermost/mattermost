// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import type {AccessControlSettings} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';
import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import ScopedConfigurationDetails from './scoped_configuration_details';

const mockPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(() => ({push: mockPush})),
}));

jest.mock('hooks/useEnabledSessionAttributeFields', () => ({
    useEnabledSessionAttributeFields: jest.fn(() => []),
}));

jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: jest.fn(),
}));

jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => ({
    __esModule: true,
    default: jest.fn((props: {onChange: (val: string) => void; hideTestButton?: boolean}) => (
        <div
            data-testid='table-editor'
            data-hide-test-button={String(Boolean(props.hideTestButton))}
        >
            <button
                type='button'
                data-testid='set-expression-btn'
                onClick={() => props.onChange('user.attributes.dept == "finance"')}
            />
        </div>
    )),
}));

jest.mock('components/admin_console/access_control/editors/cel_editor/editor', () => ({
    __esModule: true,
    default: jest.fn(() => <div data-testid='cel-editor'/>),
}));

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

describe('components/admin_console/scoped_configuration/policy_details/ScopedConfigurationDetails', () => {
    const mockFetchPolicy = jest.fn();
    const mockCreatePolicy = jest.fn();
    const mockDeletePolicy = jest.fn();
    const mockSetNavigationBlocked = jest.fn();
    const mockGetAccessControlFields = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getHistory).mockReturnValue({push: mockPush} as unknown as ReturnType<typeof getHistory>);
        jest.spyOn(Client4, 'checkAccessControlExpression').mockResolvedValue([]);
        jest.mocked(useEnabledSessionAttributeFields).mockReturnValue([]);
        mockGetAccessControlFields.mockResolvedValue({
            data: [{id: 'u1', name: 'dept', attrs: {ldap: 'department'}}],
        });
        jest.mocked(useChannelAccessControlActions).mockReturnValue({
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
    });

    function renderEditor(initialEntry: string, policyId?: string, settingKey?: string) {
        return renderWithContext(
            <MemoryRouter initialEntries={[initialEntry]}>
                <ScopedConfigurationDetails
                    policyId={policyId}
                    settingKey={settingKey}
                    accessControlSettings={accessControlSettings}
                    sessionAttributesEnabled={true}
                    actions={{
                        fetchPolicy: mockFetchPolicy,
                        createPolicy: mockCreatePolicy,
                        deletePolicy: mockDeletePolicy,
                        setNavigationBlocked: mockSetNavigationBlocked,
                    }}
                />
            </MemoryRouter>,
        );
    }

    test('prefills MobileEnableBiometrics as True from settingKey route param, hides simulate button, and saves system_setting policy', async () => {
        mockCreatePolicy.mockResolvedValue({
            data: {
                id: 'saved-id',
                name: 'Finance Biometrics',
                type: 'system_setting',
                roles: ['system_user'],
                rules: [{actions: ['MobileEnableBiometrics'], expression: 'user.attributes.dept == "finance"', value: 'false'}],
            },
        });

        renderEditor(
            '/admin_console/system_attributes/scoped_configuration/edit_policy/setting/MobileEnableBiometrics',
            undefined,
            'MobileEnableBiometrics',
        );

        const tableEditor = await screen.findByTestId('table-editor');
        expect(tableEditor).toHaveAttribute('data-hide-test-button', 'true');
        expect(jest.mocked(TableEditor)).toHaveBeenCalledWith(
            expect.objectContaining({hideTestButton: true}),
            undefined,
        );
        expect(screen.queryByText('Simulate rules')).not.toBeInTheDocument();

        expect(screen.getByTestId('scoped-setting-row-MobileEnableBiometrics')).toBeInTheDocument();
        expect(screen.getByTestId('scoped-setting-value-MobileEnableBiometrics-true')).toBeChecked();
        expect(screen.getByTestId('scoped-setting-value-MobileEnableBiometrics-false')).not.toBeChecked();

        await userEvent.click(screen.getByTestId('scoped-setting-value-MobileEnableBiometrics-false'));
        await userEvent.type(screen.getByTestId('admin.scoped_configuration.edit.policyNameinput'), 'Finance Biometrics');
        await act(async () => {
            await userEvent.click(screen.getByTestId('set-expression-btn'));
        });

        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => {
            expect(mockCreatePolicy).toHaveBeenCalledWith({
                id: '',
                name: 'Finance Biometrics',
                type: 'system_setting',
                roles: ['system_user'],
                rules: [{
                    actions: ['MobileEnableBiometrics'],
                    expression: 'user.attributes.dept == "finance"',
                    value: 'false',
                }],
            });
        });
        expect(mockPush).toHaveBeenCalledWith('/admin_console/system_attributes/scoped_configuration');
    });

    test('loads existing system_setting policy and populates fields', async () => {
        mockFetchPolicy.mockResolvedValue({
            data: {
                id: 'policy-existing',
                name: 'MDM Biometrics Relaxation',
                type: 'system_setting',
                roles: ['system_admin'],
                rules: [{
                    actions: ['MobileEnableBiometrics'],
                    expression: 'user.attributes.dept == "finance"',
                    value: 'false',
                }],
            },
        });

        renderEditor(
            '/admin_console/system_attributes/scoped_configuration/edit_policy/policy-existing',
            'policy-existing',
        );

        await screen.findByTestId('table-editor');
        expect(screen.getByTestId('admin.scoped_configuration.edit.policyNameinput')).toHaveValue('MDM Biometrics Relaxation');
        expect(screen.getByText('System administrators')).toBeInTheDocument();
        expect(screen.getByTestId('scoped-setting-value-MobileEnableBiometrics-false')).toBeChecked();
    });

    const existingPolicy = {
        id: 'policy-existing',
        name: 'MDM Biometrics Relaxation',
        type: 'system_setting',
        roles: ['system_admin'],
        rules: [{
            actions: ['MobileEnableBiometrics'],
            expression: 'user.attributes.dept == "finance"',
            value: 'false',
        }],
    };

    test('saves an edit to an existing policy under the same id', async () => {
        mockFetchPolicy.mockResolvedValue({data: existingPolicy});
        mockCreatePolicy.mockResolvedValue({data: {...existingPolicy, rules: [{...existingPolicy.rules[0], value: 'true'}]}});

        renderEditor(
            '/admin_console/system_attributes/scoped_configuration/edit_policy/policy-existing',
            'policy-existing',
        );

        await screen.findByTestId('table-editor');
        expect(screen.getByTestId('saveSetting')).toBeDisabled();

        await userEvent.click(screen.getByTestId('scoped-setting-value-MobileEnableBiometrics-true'));
        expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);

        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => {
            expect(mockCreatePolicy).toHaveBeenCalledWith({
                id: 'policy-existing',
                name: 'MDM Biometrics Relaxation',
                type: 'system_setting',
                roles: ['system_admin'],
                rules: [{
                    actions: ['MobileEnableBiometrics'],
                    expression: 'user.attributes.dept == "finance"',
                    value: 'true',
                }],
            });
        });
        expect(mockSetNavigationBlocked).toHaveBeenLastCalledWith(false);
        expect(mockPush).toHaveBeenCalledWith('/admin_console/system_attributes/scoped_configuration');
    });

    test('deletes an existing policy after confirmation and returns to the list', async () => {
        mockFetchPolicy.mockResolvedValue({data: existingPolicy});
        mockDeletePolicy.mockResolvedValue({data: true});

        renderEditor(
            '/admin_console/system_attributes/scoped_configuration/edit_policy/policy-existing',
            'policy-existing',
        );

        await screen.findByTestId('table-editor');
        await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
        expect(mockDeletePolicy).not.toHaveBeenCalled();

        await userEvent.click(await screen.findByRole('button', {name: 'Delete Policy'}));

        await waitFor(() => {
            expect(mockDeletePolicy).toHaveBeenCalledWith('policy-existing');
        });
        expect(mockCreatePolicy).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/admin_console/system_attributes/scoped_configuration');
    });
});
