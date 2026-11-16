// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {searchSystemSettingPolicies} from 'mattermost-redux/actions/access_control';
import Permissions from 'mattermost-redux/constants/permissions';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SettingPolicyControl from './setting_policy_control';

jest.mock('mattermost-redux/actions/access_control', () => ({
    ...jest.requireActual('mattermost-redux/actions/access_control'),
    searchSystemSettingPolicies: jest.fn(),
}));

describe('components/admin_console/scoped_configuration/SettingPolicyControl', () => {
    function makeState(overrides: {
        sku?: string;
        abacEnabled?: boolean;
        flagEnabled?: boolean;
        hasPermission?: boolean;
    } = {}) {
        const {
            sku = 'advanced',
            abacEnabled = true,
            flagEnabled = true,
            hasPermission = true,
        } = overrides;

        return {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: sku,
                    },
                    config: {
                        EnableAttributeBasedAccessControl: String(abacEnabled),
                        FeatureFlagSystemSettingPolicies: String(flagEnabled),
                    },
                },
                admin: {
                    config: {
                        AccessControlSettings: {
                            EnableAttributeBasedAccessControl: abacEnabled,
                        },
                        FeatureFlags: {
                            SystemSettingPolicies: flagEnabled,
                        },
                    },
                },
                users: {
                    currentUserId: 'admin-id',
                    profiles: {
                        'admin-id': {
                            id: 'admin-id',
                            roles: 'system_admin',
                        },
                    },
                },
                roles: {
                    roles: {
                        system_admin: {
                            id: 'system_admin',
                            name: 'system_admin',
                            permissions: hasPermission ? [Permissions.MANAGE_SYSTEM] : [],
                        },
                    },
                },
            },
            views: {
                admin: {
                    navigationBlock: {
                        blocked: false,
                    },
                },
            },
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders Configure with a policy link with setting path param when no policy exists', async () => {
        jest.mocked(searchSystemSettingPolicies).mockReturnValue(
            () => Promise.resolve({data: {policies: [], total: 0}}),
        );

        renderWithContext(
            <MemoryRouter>
                <SettingPolicyControl settingKey='MobileEnableBiometrics'/>
            </MemoryRouter>,
            makeState(),
        );

        const link = await screen.findByRole('link', {name: 'Configure with a policy'});
        expect(link).toHaveAttribute(
            'href',
            '/admin_console/system_attributes/scoped_configuration/edit_policy/setting/MobileEnableBiometrics',
        );
        expect(jest.mocked(searchSystemSettingPolicies)).toHaveBeenCalledWith('', '', 1, ['MobileEnableBiometrics']);
    });

    test('renders View existing policy link and policy name when a policy is attached', async () => {
        jest.mocked(searchSystemSettingPolicies).mockReturnValue(
            () => Promise.resolve({
                data: {
                    policies: [{
                        id: 'pol-123',
                        name: 'Finance Biometrics',
                        type: 'system_setting',
                        roles: ['system_user'],
                        rules: [{actions: ['MobileEnableBiometrics'], expression: 'true', value: 'true'}],
                    }],
                    total: 1,
                },
            }),
        );

        renderWithContext(
            <MemoryRouter>
                <SettingPolicyControl settingKey='MobileEnableBiometrics'/>
            </MemoryRouter>,
            makeState(),
        );

        const link = await screen.findByRole('link', {name: 'View existing policy'});
        expect(link).toHaveAttribute(
            'href',
            '/admin_console/system_attributes/scoped_configuration/edit_policy/pol-123',
        );
        expect(screen.getByText('Policy: Finance Biometrics')).toBeInTheDocument();
    });

    test('renders nothing when unlicensed, ABAC disabled, flag off, or user lacks MANAGE_SYSTEM', () => {
        for (const variant of [
            {sku: 'enterprise'},
            {abacEnabled: false},
            {flagEnabled: false},
            {hasPermission: false},
        ]) {
            const {container} = renderWithContext(
                <MemoryRouter>
                    <SettingPolicyControl settingKey='MobileEnableBiometrics'/>
                </MemoryRouter>,
                makeState(variant),
            );
            expect(container).toBeEmptyDOMElement();
        }
        expect(jest.mocked(searchSystemSettingPolicies)).not.toHaveBeenCalled();
    });
});
