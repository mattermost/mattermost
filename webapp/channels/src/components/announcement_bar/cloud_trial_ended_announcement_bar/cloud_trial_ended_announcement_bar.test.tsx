// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {CloudProducts, Preferences, CloudBanners} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';

import CloudTrialEndAnnouncementBar from './index';

describe('components/global/CloudTrialEndAnnouncementBar', () => {
    const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

    beforeEach(() => {
        useDispatchMock.mockClear();
    });
    const initialState = {
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
        entities: {
            preferences: {
                myPreferences: {
                    category: Preferences.CLOUD_TRIAL_END_BANNER,
                    name: CloudBanners.HIDE,
                    user_id: 'current_user_id',
                    value: 'false',
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
                limits: {
                    limitsLoaded: true,
                    limits: {
                        integrations: {
                            enabled: 10,
                        },
                        messages: {
                            history: 10000,
                        },
                        files: {
                            total_storage: FileSizes.Gigabyte,
                        },
                        teams: {
                            active: 1,
                        },
                        boards: {
                            cards: 500,
                            views: 5,
                        },
                    },
                },
            },
            usage: {
                integrations: {
                    enabled: 11,
                    enabledLoaded: true,
                },
                messages: {
                    history: 10000,
                    historyLoaded: true,
                },
                files: {
                    totalStorage: FileSizes.Gigabyte,
                    totalStorageLoaded: true,
                },
                teams: {
                    active: 1,
                    cloudArchived: 0,
                    teamsLoaded: true,
                },
                boards: {
                    cards: 500,
                    cardsLoaded: true,
                },
            },
        },
    };
    it('Should show banner when not on free trial with a trial_end_at in the past', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            trial_end_at: 1655577344000,
        };

        // Set the system time to be June 20th, since this banner won't show for trial's ending prior to June 15
        jest.useFakeTimers().setSystemTime(new Date('2022-06-20'));

        const store = mockStore(state);

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudTrialEndAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(
            wrapper.find('AnnouncementBar').exists(),
        ).toEqual(true);
    });

    it('Should show banner cloudArchived teams exist', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            trial_end_at: 1655577344000,
        };
        state.entities.usage.teams = {
            cloudArchived: 2,
            active: -1,
            teamsLoaded: true,
        };

        // Set the system time to be June 20th, since this banner won't show for trial's ending prior to June 15
        jest.useFakeTimers().setSystemTime(new Date('2022-06-20'));

        const store = mockStore(state);

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudTrialEndAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toEqual(true);
    });

    it('should not show banner if on free trial', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud = {
            subscription: {
                product_id: 'test_prod_2',
                is_free_trial: 'true',
                trial_end_at: new Date(
                    new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
                ),
            },
            products: {
                test_prod_2: {
                    id: 'test_prod_2',
                    sku: CloudProducts.ENTERPRISE,
                    price_per_seat: 10,
                },
            },
            limits: {
                limitsLoaded: true,
                limits: {
                    integrations: {
                        enabled: 10,
                    },
                    messages: {
                        history: 10000,
                    },
                    files: {
                        total_storage: FileSizes.Gigabyte,
                    },
                    teams: {
                        active: 1,
                    },
                    boards: {
                        cards: 500,
                        views: 5,
                    },
                },
            },
            usage: {
                integrations: {
                    enabled: 11,
                    enabledLoaded: true,
                },
                messages: {
                    history: 10000,
                    historyLoaded: true,
                },
                files: {
                    totalStorage: FileSizes.Gigabyte,
                    totalStorageLoaded: true,
                },
                teams: {
                    active: 1,
                    teamsLoaded: true,
                },
                boards: {
                    cards: 500,
                    cardsLoaded: true,
                },
            },
        };

        const store = mockStore(state);

        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudTrialEndAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(
            wrapper.find('AnnouncementBar').exists(),
        ).toEqual(false);
    });

    it('should not show for non-admins', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'user'},
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudTrialEndAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(
            wrapper.find('AnnouncementBar').exists(),
        ).toEqual(false);
    });

    it('should not show for enterprise workspaces', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription.product_id = 'test_prod_2';

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudTrialEndAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toEqual(false);
    });

    it('should not show for professional workspaces', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription.product_id = 'test_prod_3';

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudTrialEndAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toEqual(false);
    });

    it('Should not show banner if preference is set to hidden', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.preferences = {
            myPreferences: {
                [getPreferenceKey(
                    Preferences.CLOUD_TRIAL_END_BANNER,
                    CloudBanners.HIDE,
                )]: {name: CloudBanners.HIDE, value: 'true'},
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <CloudTrialEndAnnouncementBar/>
            </reactRedux.Provider>,
        );

        expect(
            wrapper.find('AnnouncementBar').exists(),
        ).toEqual(false);
    });
});
