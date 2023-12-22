// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';

import CloudDelinquencyAnnouncementBar from './index';

describe('components/announcement_bar/cloud_delinquency', () => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000)).getTime() / 1000;
    const fiveDaysFromNow = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000)).getTime() / 1000;
    const initialState = {
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
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
                    delinquent_since: fiveDaysAgo, // may 17 2022
                    cancel_at: fiveDaysFromNow, // may 17 2022
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

    it('Should not show banner when not delinquent', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            delinquent_since: null,
        };

        const {queryByText} = renderWithContext(
            <CloudDelinquencyAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription has expired')).not.toBeInTheDocument();
    });

    it('Should not show banner when no cancel_at time is set', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: null,
        };

        const {queryByText} = renderWithContext(
            <CloudDelinquencyAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription has expired')).not.toBeInTheDocument();
    });

    it('Should show banner when user is not admin, but should not show CTA', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'user'},
            },
        };

        const {queryByText, getByText} = renderWithContext(
            <CloudDelinquencyAnnouncementBar/>,
            state,
        );

        expect(getByText('Your annual subscription has expired. Please contact your System Admin to keep this workspace')).toBeInTheDocument();
        expect(queryByText('Update billing now')).not.toBeInTheDocument();
    });

    it('Should show banner and CTA when user is admin', () => {
        const state = JSON.parse(JSON.stringify(initialState));

        const {getByText} = renderWithContext(
            <CloudDelinquencyAnnouncementBar/>,
            state,
        );

        expect(getByText('Your annual subscription has expired. Please renew now to keep this workspace')).toBeInTheDocument();
        expect(getByText('Update billing now')).toBeInTheDocument();
    });
});
