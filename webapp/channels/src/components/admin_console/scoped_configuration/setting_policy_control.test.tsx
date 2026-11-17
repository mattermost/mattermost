// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import {AdminTypes} from 'mattermost-redux/action_types';
import {getSystemSettingPolicyOrder, searchSystemSettingPolicies} from 'mattermost-redux/actions/access_control';
import Permissions from 'mattermost-redux/constants/permissions';

import {act, renderWithContext, screen, within} from 'tests/react_testing_utils';

import SettingPolicyControl from './setting_policy_control';

jest.mock('mattermost-redux/actions/access_control', () => ({
    ...jest.requireActual('mattermost-redux/actions/access_control'),
    searchSystemSettingPolicies: jest.fn(),
    getSystemSettingPolicyOrder: jest.fn(),
}));

const bannerPolicy = (id: string, name: string): AccessControlPolicy => ({
    id,
    name,
    type: 'system_setting',
    roles: ['system_user'],
    rules: [{actions: ['BannerText'], expression: 'true', value: name}],
});

describe('components/admin_console/scoped_configuration/SettingPolicyControl', () => {
    function makeState(overrides: {
        sku?: string;
        abacEnabled?: boolean;
        flagEnabled?: boolean;
        hasPermission?: boolean;
        order?: string[];
    } = {}) {
        const {
            sku = 'advanced',
            abacEnabled = true,
            flagEnabled = true,
            hasPermission = true,
            order = [],
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
                    systemSettingPolicyOrder: order,
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
        jest.mocked(getSystemSettingPolicyOrder).mockReturnValue(
            (() => Promise.resolve({data: {policy_ids: []}})) as unknown as ReturnType<typeof getSystemSettingPolicyOrder>,
        );
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
        expect(jest.mocked(searchSystemSettingPolicies)).toHaveBeenCalledWith('', '', 100, ['MobileEnableBiometrics']);
        expect(jest.mocked(getSystemSettingPolicyOrder)).toHaveBeenCalled();
    });

    test('lists every policy for the setting in priority order with links and an Add policy link', async () => {
        jest.mocked(searchSystemSettingPolicies).mockReturnValue(
            () => Promise.resolve({
                data: {
                    policies: [
                        bannerPolicy('eng', 'Engineering banner'),
                        bannerPolicy('everyone', 'Everyone banner'),
                        bannerPolicy('fin', 'Finance banner'),
                    ],
                    total: 3,
                },
            }),
        );

        const {store} = renderWithContext(
            <MemoryRouter>
                <SettingPolicyControl settingKey='BannerText'/>
            </MemoryRouter>,
            makeState({order: ['fin', 'eng', 'everyone']}),
        );

        expect(await screen.findByText('Policies affecting this setting, in priority order:')).toBeInTheDocument();
        const names = () => within(screen.getByRole('list')).getAllByRole('link').map((link) => link.textContent);
        expect(names()).toEqual(['Finance banner', 'Engineering banner', 'Everyone banner']);
        expect(screen.getByRole('link', {name: 'Finance banner'})).toHaveAttribute(
            'href',
            '/admin_console/system_attributes/scoped_configuration/edit_policy/fin',
        );
        expect(screen.getByRole('link', {name: 'Add policy'})).toHaveAttribute(
            'href',
            '/admin_console/system_attributes/scoped_configuration/edit_policy/setting/BannerText',
        );
        expect(screen.getByRole('link', {name: 'Change priority'})).toHaveAttribute(
            'href',
            '/admin_console/system_attributes/scoped_configuration',
        );
        expect(screen.queryByRole('link', {name: 'Configure with a policy'})).not.toBeInTheDocument();

        act(() => {
            store.dispatch({type: AdminTypes.RECEIVED_SYSTEM_SETTING_POLICY_ORDER, data: {policy_ids: ['everyone', 'fin', 'eng']}});
        });
        expect(names()).toEqual(['Everyone banner', 'Finance banner', 'Engineering banner']);
    });

    test('lists a single policy without the Change priority link', async () => {
        jest.mocked(searchSystemSettingPolicies).mockReturnValue(
            () => Promise.resolve({
                data: {policies: [bannerPolicy('pol-123', 'Finance Biometrics')], total: 1},
            }),
        );

        renderWithContext(
            <MemoryRouter>
                <SettingPolicyControl settingKey='MobileEnableBiometrics'/>
            </MemoryRouter>,
            makeState(),
        );

        expect(await screen.findByRole('link', {name: 'Finance Biometrics'})).toHaveAttribute(
            'href',
            '/admin_console/system_attributes/scoped_configuration/edit_policy/pol-123',
        );
        expect(screen.getByRole('link', {name: 'Add policy'})).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: 'Change priority'})).not.toBeInTheDocument();
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
