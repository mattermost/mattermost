// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import {CloudProducts} from 'utils/constants';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import CloudDelinquencyAnnouncementBar from './index';

describe('components/announcement_bar/cloud_delinquency', () => {
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
                    delinquent_since: 1652807380, // may 17 2022
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

        jest.useFakeTimers().setSystemTime(new Date('2022-06-20'));

        const store = mockStore(state);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudDelinquencyAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toEqual(false);
    });

    it('Should not show banner when user is not admin', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'user'},
            },
        };

        jest.useFakeTimers().setSystemTime(new Date('2022-06-20'));

        const store = mockStore(state);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudDelinquencyAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toEqual(false);
    });

    it('Should match snapshot when delinquent < 90 days', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        const store = mockStore(state);
        jest.useFakeTimers().setSystemTime(new Date('2022-06-20'));

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudDelinquencyAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(wrapper.find('.announcement-bar-advisor').exists()).toEqual(true);
    });

    it('Should match snapshot when delinquent > 90 days', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        const store = mockStore(state);
        jest.useFakeTimers().setSystemTime(new Date('2022-12-20'));

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudDelinquencyAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(wrapper.find('.announcement-bar-critical').exists()).toEqual(true);
    });
});
