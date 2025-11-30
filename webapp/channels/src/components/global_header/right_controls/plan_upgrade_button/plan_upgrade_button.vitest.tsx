// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import * as cloudActions from 'mattermost-redux/actions/cloud';

import {renderWithContext, act} from 'tests/vitest_react_testing_utils';
import {CloudProducts} from 'utils/constants';

import PlanUpgradeButton from './index';

describe('components/global/PlanUpgradeButton', () => {
    const useDispatchMock = vi.spyOn(reactRedux, 'useDispatch');

    beforeEach(() => {
        useDispatchMock.mockClear();
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

    it('should show Upgrade button in global header for admin users, cloud free subscription', async () => {
        const cloudSubscriptionSpy = vi.spyOn(cloudActions, 'getCloudSubscription');
        const cloudProductsSpy = vi.spyOn(cloudActions, 'getCloudProducts');

        const dummyDispatch = vi.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        await act(async () => {
            renderWithContext(
                <PlanUpgradeButton/>,
                initialState,
            );
        });

        expect(cloudSubscriptionSpy).toHaveBeenCalledTimes(1);
        expect(cloudProductsSpy).toHaveBeenCalledTimes(1);
        expect(document.getElementById('UpgradeButton')).toBeInTheDocument();
    });

    it('should show Upgrade button in global header for admin users, cloud and enterprise trial subscription', async () => {
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

        const dummyDispatch = vi.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        await act(async () => {
            renderWithContext(
                <PlanUpgradeButton/>,
                state,
            );
        });

        expect(document.getElementById('UpgradeButton')).toBeInTheDocument();
    });

    it('should not show for cloud enterprise non-trial', async () => {
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

        const dummyDispatch = vi.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        await act(async () => {
            renderWithContext(
                <PlanUpgradeButton/>,
                state,
            );
        });

        expect(document.getElementById('UpgradeButton')).not.toBeInTheDocument();
    });

    it('should not show for cloud professional product', async () => {
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

        const dummyDispatch = vi.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        await act(async () => {
            renderWithContext(
                <PlanUpgradeButton/>,
                state,
            );
        });

        expect(document.getElementById('UpgradeButton')).not.toBeInTheDocument();
    });

    it('should not show Upgrade button in global header for non admin cloud users', async () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        };

        const dummyDispatch = vi.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        await act(async () => {
            renderWithContext(
                <PlanUpgradeButton/>,
                state,
            );
        });

        expect(document.getElementById('UpgradeButton')).not.toBeInTheDocument();
    });

    it('should not show Upgrade button in global header for non admin self hosted users', async () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        };
        state.entities.general.license = {
            IsLicensed: 'false', // starter
            Cloud: 'false',
        };

        const dummyDispatch = vi.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        await act(async () => {
            renderWithContext(
                <PlanUpgradeButton/>,
                state,
            );
        });

        expect(document.getElementById('UpgradeButton')).not.toBeInTheDocument();
    });

    it('should not show Upgrade button in global header for non enterprise edition self hosted users', async () => {
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

        const dummyDispatch = vi.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        await act(async () => {
            renderWithContext(
                <PlanUpgradeButton/>,
                state,
            );
        });

        expect(document.getElementById('UpgradeButton')).not.toBeInTheDocument();
    });

    it('should NOT show Upgrade button in global header for self hosted non trial and licensed', async () => {
        const state = JSON.parse(JSON.stringify(initialState));

        state.entities.general.license = {
            IsLicensed: 'true',
            Cloud: 'false',
        };

        const cloudSubscriptionSpy = vi.spyOn(cloudActions, 'getCloudSubscription');
        const cloudProductsSpy = vi.spyOn(cloudActions, 'getCloudProducts');

        // Clear previous calls
        cloudSubscriptionSpy.mockClear();
        cloudProductsSpy.mockClear();

        const dummyDispatch = vi.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        await act(async () => {
            renderWithContext(
                <PlanUpgradeButton/>,
                state,
            );
        });

        expect(cloudSubscriptionSpy).toHaveBeenCalledTimes(0); // no calls to cloud endpoints for non cloud
        expect(cloudProductsSpy).toHaveBeenCalledTimes(0);
        expect(document.getElementById('UpgradeButton')).not.toBeInTheDocument();
    });
});
