// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {CloudProducts, LicenseSkus} from 'utils/constants';

import ADLDAPUpsellBanner from './ad_ldap_upsell_banner';

describe('component/user_groups_modal/ad_ldap_upsell_banner', () => {
    const initState = {
        entities: {
            general: {
                license: {
                    Cloud: 'false',
                    SkuShortName: LicenseSkus.Professional,
                    ExpiresAt: '100000000',
                },
                config: {},
            },
            cloud: {},
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {
                        id: 'user1',
                        roles: 'system_admin',
                    },
                },
            },
        },
    };

    test('should display for admin users on professional with option to start trial if no self-hosted trial before', () => {
        renderWithContext(
            <ADLDAPUpsellBanner/>,
            initState as any,
        );

        expect(screen.getByText('AD/LDAP group sync creates groups faster')).toBeInTheDocument();
        expect(screen.getByText('Start trial')).toBeInTheDocument();
    });

    test('should display for admin users on professional with option to contact sales if self-hosted trialed before', () => {
        const state = JSON.parse(JSON.stringify(initState));
        state.entities.admin.prevTrialLicense.IsLicensed = 'true';

        renderWithContext(
            <ADLDAPUpsellBanner/>,
            state,
        );

        expect(screen.getByText('AD/LDAP group sync creates groups faster')).toBeInTheDocument();
        expect(screen.getByText('Contact sales to use')).toBeInTheDocument();
    });

    test('should display for admin users on professional with option to contact sales if cloud trialed before', async () => {
        const state = JSON.parse(JSON.stringify(initState));
        state.entities.admin = {};
        state.entities.general.license = {
            Cloud: 'true',
            ExpiresAt: 100000000,
        };
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_professional',
                is_free_trial: 'false',
                trial_end_at: 1,
            },
            products: {
                prod_professional: {
                    id: 'prod_professional',
                    sku: CloudProducts.PROFESSIONAL,
                },
            },
        };

        renderWithContext(
            <ADLDAPUpsellBanner/>,
            state,
        );

        expect(screen.getByText('AD/LDAP group sync creates groups faster')).toBeInTheDocument();
        expect(screen.getByText('Contact sales to use')).toBeInTheDocument();
    });

    test('should not display for non admin users', () => {
        const state = JSON.parse(JSON.stringify(initState));
        state.entities.users.profiles.user1.roles = 'system_user';

        renderWithContext(
            <ADLDAPUpsellBanner/>,
            state,
        );

        expect(screen.queryByText('AD/LDAP group sync creates groups faster')).not.toBeInTheDocument();
    });

    test('should not display for non self-hosted professional users', () => {
        const state = JSON.parse(JSON.stringify(initState));
        state.entities.general.license.SkuShortName = LicenseSkus.Enterprise;

        renderWithContext(
            <ADLDAPUpsellBanner/>,
            state,
        );

        expect(screen.queryByText('AD/LDAP group sync creates groups faster')).not.toBeInTheDocument();
    });

    test('should not display for non cloud professional users', async () => {
        const state = JSON.parse(JSON.stringify(initState));
        state.entities.admin = {};
        state.entities.general.license = {
            Cloud: 'true',
            ExpiresAt: 100000000,
        };
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_starter',
                is_free_trial: 'false',
                trial_end_at: 1,
            },
            products: {
                prod_starter: {
                    id: 'prod_starter',
                    sku: CloudProducts.STARTER,
                },
            },
        };

        renderWithContext(
            <ADLDAPUpsellBanner/>,
            state,
        );

        expect(screen.queryByText('AD/LDAP group sync creates groups faster')).not.toBeInTheDocument();
    });
});
