// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {unixTimestampFromNow} from 'tests/helpers/date';
import {renderWithContext} from 'tests/react_testing_utils';
import {CloudBanners, CloudProducts, Preferences} from 'utils/constants';

import CloudAnnualRenewalAnnouncementBar, {getCurrentYearAsString} from './index';

describe('components/announcement_bar/cloud_annual_renewal', () => {
    const initialState = {
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
        entities: {
            admin: {
                config: {
                    FeatureFlags: {
                        CloudAnnualRenewals: true,
                    },
                },
            },
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
                    cancel_at: null,
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

    it('Should not show banner when feature flag is disabled time set', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.general.config = {
            ...state.entities.admin.config,
            CloudAnnualRenewals: false,
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });

    it('Should not show banner when no cancel_at time set', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: null,
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });

    it('Should show 60 day banner to admin when cancel_at time is set accordingly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(55),
        };

        const {getByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(getByText('Your annual subscription expires in 55 days. Please renew to avoid any disruption.')).toBeInTheDocument();
    });

    it('Should NOT show 60 day banner to non-admin when cancel_at time is set accordingly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(55),
        };

        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'user'},
            },
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });

    it('Should show 30 day banner to admin when cancel_at time is set accordingly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(25),
        };

        const {getByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(getByText('Your annual subscription expires in 25 days. Please renew to avoid any disruption.')).toBeInTheDocument();
    });

    it('Should NOT show 30 day banner to non-admin when cancel_at time is set accordingly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(25),
        };

        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'user'},
            },
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });

    it('Should show 7 day banner to admin when cancel_at time is set accordingly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(5),
        };

        const {getByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(getByText('Your annual subscription expires in 5 days. Failure to renew will result in your workspace being deleted.')).toBeInTheDocument();
    });

    it('Should NOT show 7 day banner to non admin when cancel_at time is set accordingly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(5),
        };

        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'user'},
            },
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });

    it('Should NOT show 7 day banner to admin when delinquent_since is set', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(5),
            delinquent_since: unixTimestampFromNow(5),
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in 6 days. Failure to renew will result in your workspace being deleted.')).not.toBeInTheDocument();
    });

    it('Should NOT show 60 day banner to admin when they dismissed the banner', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(55),
        };

        state.entities.preferences = {
            myPreferences: {
                [`${Preferences.CLOUD_ANNUAL_RENEWAL_BANNER}--${CloudBanners.ANNUAL_RENEWAL_60_DAY}_${getCurrentYearAsString()}`]: {
                    user_id: 'rq7fq4hfjp8ifywsfwk114545a',
                    category: 'cloud_annual_renewal_banner',
                    name: 'annual_renewal_60_day_2023',
                    value: 'true',
                },
            },
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });

    it('Should NOT show 30 day banner to admin when they dismissed the banner', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(25),
        };

        state.entities.preferences = {
            myPreferences: {
                [`${Preferences.CLOUD_ANNUAL_RENEWAL_BANNER}--${CloudBanners.ANNUAL_RENEWAL_30_DAY}_${getCurrentYearAsString()}`]: {
                    user_id: 'rq7fq4hfjp8ifywsfwk114545a',
                    category: 'cloud_annual_renewal_banner',
                    name: 'annual_renewal_30_day_2023',
                    value: 'true',
                },
            },
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });

    it('Should show 60 day banner to admin in 2023 when they dismissed the banner in 2022', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(55),
        };

        state.entities.preferences = {
            myPreferences: {
                [`${Preferences.CLOUD_ANNUAL_RENEWAL_BANNER}--${CloudBanners.ANNUAL_RENEWAL_60_DAY}_2022`]: {
                    user_id: 'rq7fq4hfjp8ifywsfwk114545a',
                    category: 'cloud_annual_renewal_banner',
                    name: 'annual_renewal_60_day_2022',
                    value: 'true',
                },
            },
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in 55 days. Please renew to avoid any disruption.')).toBeInTheDocument();
    });

    it('Should show 30 day banner to admin in 2023 when they dismissed the banner in 2022', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(25),
        };

        state.entities.preferences = {
            myPreferences: {
                [`${Preferences.CLOUD_ANNUAL_RENEWAL_BANNER}--${CloudBanners.ANNUAL_RENEWAL_30_DAY}_2022`]: {
                    user_id: 'rq7fq4hfjp8ifywsfwk114545a',
                    category: 'cloud_annual_renewal_banner',
                    name: 'annual_renewal_30_day_2022',
                    value: 'true',
                },
            },
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in 25 days. Please renew to avoid any disruption.')).toBeInTheDocument();
    });

    it('Should NOT show any banner if renewal date is more than 60 days away"', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(75),
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });

    it('Should NOT show any banner if within renewal period but will_renew is set to "true"', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            cancel_at: unixTimestampFromNow(69),
            end_at: unixTimestampFromNow(25),
            will_renew: 'true',
        };

        const {queryByText} = renderWithContext(
            <CloudAnnualRenewalAnnouncementBar/>,
            state,
        );

        expect(queryByText('Your annual subscription expires in')).not.toBeInTheDocument();
    });
});
