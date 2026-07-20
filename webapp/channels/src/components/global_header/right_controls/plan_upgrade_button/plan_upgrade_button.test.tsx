// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as cloudActions from 'mattermost-redux/actions/cloud';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';

import PlanUpgradeButton from './index';

jest.mock('components/common/hooks/useOpenPricingModal', () => ({
    __esModule: true,
    default: () => ({openPricingModal: jest.fn(), isAirGapped: false}),
}));

describe('components/global/PlanUpgradeButton', () => {
    beforeEach(() => {
        jest.spyOn(cloudActions, 'getCloudSubscription').mockReturnValue({type: 'MOCK_GET_CLOUD_SUBSCRIPTION'} as any);
        jest.spyOn(cloudActions, 'getCloudProducts').mockReturnValue({type: 'MOCK_GET_CLOUD_PRODUCTS'} as any);
    });

    const initialState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
                config: {
                    BuildEnterpriseReady: 'true',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin'},
                },
            },
            cloud: {
                subscription: {
                    product_id: 'test_prod_1',
                },
                products: {
                    test_prod_1: {
                        id: 'test_prod_1',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                    },
                },
            },
        },
    };

    it('should show Upgrade button in global header for admin users, cloud free subscription', () => {
        const cloudSubscriptionSpy = jest.spyOn(cloudActions, 'getCloudSubscription');
        const cloudProductsSpy = jest.spyOn(cloudActions, 'getCloudProducts');

        renderWithContext(
            <PlanUpgradeButton/>,
            initialState,
        );

        expect(cloudSubscriptionSpy).toHaveBeenCalledTimes(1);
        expect(cloudProductsSpy).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', {name: 'View plans'})).toBeInTheDocument();
    });

    it('should show Upgrade button in global header for admin users, cloud and enterprise trial subscription', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud = {
            subscription: {
                product_id: 'test_prod_2',
                is_free_trial: 'true',
            },
            products: {
                test_prod_2: {
                    id: 'test_prod_2',
                    sku: CloudProducts.ENTERPRISE,
                    price_per_seat: 10,
                },
            },
        };

        renderWithContext(
            <PlanUpgradeButton/>,
            state,
        );

        expect(screen.getByRole('button', {name: 'View plans'})).toBeInTheDocument();
    });

    it('should not show for cloud enterprise non-trial', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud = {
            subscription: {
                product_id: 'test_prod_3',
                is_free_trial: 'false',
            },
            products: {
                test_prod_3: {
                    id: 'test_prod_3',
                    sku: CloudProducts.ENTERPRISE,
                    price_per_seat: 10,
                },
            },
        };

        renderWithContext(
            <PlanUpgradeButton/>,
            state,
        );

        expect(screen.queryByRole('button', {name: 'View plans'})).not.toBeInTheDocument();
    });

    it('should not show for cloud professional product', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud = {
            subscription: {
                product_id: 'test_prod_4',
                is_free_trial: 'false',
            },
            products: {
                test_prod_4: {
                    id: 'test_prod_4',
                    sku: CloudProducts.PROFESSIONAL,
                    price_per_seat: 10,
                },
            },
        };

        renderWithContext(
            <PlanUpgradeButton/>,
            state,
        );

        expect(screen.queryByRole('button', {name: 'View plans'})).not.toBeInTheDocument();
    });

    it('should not show Upgrade button in global header for non admin cloud users', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        };

        renderWithContext(
            <PlanUpgradeButton/>,
            state,
        );

        expect(screen.queryByRole('button', {name: 'View plans'})).not.toBeInTheDocument();
    });

    it('should not show Upgrade button in global header for non admin self hosted users', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        };
        state.entities.general.license = {
            IsLicensed: 'false',
            Cloud: 'false',
        };

        renderWithContext(
            <PlanUpgradeButton/>,
            state,
        );

        expect(screen.queryByRole('button', {name: 'View plans'})).not.toBeInTheDocument();
    });

    it('should not show Upgrade button in global header for non enterprise edition self hosted users', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        };

        state.entities.general.license = {
            IsLicensed: 'false',
            Cloud: 'false',
        };

        state.entities.general.config = {
            BuildEnterpriseReady: 'false',
        };

        renderWithContext(
            <PlanUpgradeButton/>,
            state,
        );

        expect(screen.queryByRole('button', {name: 'View plans'})).not.toBeInTheDocument();
    });

    it('should NOT show Upgrade button in global header for self hosted non trial and licensed', () => {
        const state = JSON.parse(JSON.stringify(initialState));

        state.entities.general.license = {
            IsLicensed: 'true',
            Cloud: 'false',
        };

        const cloudSubscriptionSpy = jest.spyOn(cloudActions, 'getCloudSubscription');
        const cloudProductsSpy = jest.spyOn(cloudActions, 'getCloudProducts');

        renderWithContext(
            <PlanUpgradeButton/>,
            state,
        );

        expect(cloudSubscriptionSpy).toHaveBeenCalledTimes(0);
        expect(cloudProductsSpy).toHaveBeenCalledTimes(0);
        expect(screen.queryByRole('button', {name: 'View plans'})).not.toBeInTheDocument();
    });
});
