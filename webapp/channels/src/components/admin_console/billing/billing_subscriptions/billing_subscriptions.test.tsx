// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {unixTimestampFromNow} from 'tests/helpers/date';
import {renderWithContext} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';

import {CloudAnnualRenewalBanner} from './billing_subscriptions';

describe('CloudAnnualRenewalBanner', () => {
    const initialState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
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
                    trial_end_at: 1652807380,
                    is_free_trial: 'false',
                    cancel_at: 1652807380,
                },
                products: {
                    test_prod_1: {
                        id: 'test_prod_1',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                    },
                    test_prod_2: {
                        id: 'test_prod_2',
                        sku: CloudProducts.ENTERPRISE,
                        price_per_seat: 0,
                    },
                    test_prod_3: {
                        id: 'test_prod_3',
                        sku: CloudProducts.PROFESSIONAL,
                        price_per_seat: 0,
                    },
                },
            },
        },
    };

    it('should not render if subscription is not available', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = null;

        const {queryByText} = renderWithContext(<CloudAnnualRenewalBanner/>, state);

        expect(queryByText(/Your annual subscription expires in/)).not.toBeInTheDocument();
    });

    it('should render with correct title and buttons', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            end_at: unixTimestampFromNow(30),
        };
        const {getByText} = renderWithContext(<CloudAnnualRenewalBanner/>, state);

        expect(getByText(/Your annual subscription expires in 30 days. Please renew now to avoid any disruption/)).toBeInTheDocument();
        expect(getByText(/Renew/)).toBeInTheDocument();
        expect(getByText(/Contact Sales/)).toBeInTheDocument();

        const renewButton = getByText(/Renew/);
        renewButton.click();
    });

    it('should render with danger mode if expiration is within 7 days', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            end_at: unixTimestampFromNow(4),
        };
        const {getByText, getByTestId} = renderWithContext(<CloudAnnualRenewalBanner/>, state);

        expect(getByText(/Your annual subscription expires in 4 days. Please renew now to avoid any disruption/)).toBeInTheDocument();
        expect(getByText(/Renew/)).toBeInTheDocument();
        expect(getByText(/Contact Sales/)).toBeInTheDocument();
        expect(getByTestId('cloud_annual_renewal_alert_banner_danger')).toBeInTheDocument();
    });

    it('should render with with different title when end_at time has passed', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            end_at: unixTimestampFromNow(-5),
            cancel_at: unixTimestampFromNow(5),
        };
        const {getByText, getByTestId} = renderWithContext(<CloudAnnualRenewalBanner/>, state);

        expect(getByText(/Your subscription has expired. Your workspace will be deleted in 5 days. Please renew now to avoid any disruption/)).toBeInTheDocument();
        expect(getByText(/Renew/)).toBeInTheDocument();
        expect(getByText(/Contact Sales/)).toBeInTheDocument();
        expect(getByTestId('cloud_annual_renewal_alert_banner_danger')).toBeInTheDocument();
    });
});
