// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {CloudProducts, RecurringIntervals} from 'utils/constants';

import {ToYearlyNudgeBanner, ToYearlyNudgeBannerDismissable} from './to_yearly_nudge_banner';

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
            config: {
                CWSURL: '',
            },
            license: {
                IsLicensed: 'true',
                Cloud: 'true',
            },
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        },
        preferences: {
            myPreferences: {},
        },
        cloud: {},
    },
};

describe('components/admin_console/billing/ToYearlyNudgeBannerDismissable', () => {
    test('should show for admins cloud professional monthly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_admin'},
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
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToYearlyNudgeBannerDismissable/>
            </Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toBe(true);
    });

    test('should NOT show for NON admins', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_user'},
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
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToYearlyNudgeBannerDismissable/>
            </Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toBe(false);
    });

    test('should NOT show for admins on cloud free', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_admin'},
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
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToYearlyNudgeBannerDismissable/>
            </Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toBe(false);
    });

    test('should NOT show for admins on cloud enterprise', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_admin'},
        };
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_enterprise',
                is_free_trial: 'false',
                trial_end_at: 1,
            },
            products: {
                prod_enterprise: {
                    id: 'prod_enterprise',
                    sku: CloudProducts.ENTERPRISE,
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToYearlyNudgeBannerDismissable/>
            </Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toBe(false);
    });

    test('should NOT show for admins on cloud pro annual', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_admin'},
        };
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_pro',
                is_free_trial: 'false',
                trial_end_at: 1,
            },
            products: {
                prod_pro: {
                    id: 'prod_pro',
                    sku: CloudProducts.PROFESSIONAL,
                    recurring_interval: RecurringIntervals.YEAR,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToYearlyNudgeBannerDismissable/>
            </Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toBe(false);
    });

    test('should NOT show for admins when banner was dismissed in preferences', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_admin'},
        };
        state.entities.preferences = {
            myPreferences: {
                'cloud_yearly_nudge_banner--nudge_to_yearly_banner_dismissed': {
                    category: 'cloud_yearly_nudge_banner',
                    name: 'nudge_to_yearly_banner_dismissed',
                    value: 'true',
                },
            },
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
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToYearlyNudgeBannerDismissable/>
            </Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toBe(false);
    });
});

describe('components/admin_console/billing/ToYearlyNudgeBanner', () => {
    test('should show for cloud professional monthly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
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
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToYearlyNudgeBanner/>
            </Provider>,
        );

        expect(wrapper.find('AlertBanner').exists()).toBe(true);
    });

    test('should NOT show for non cloud professional monthly', () => {
        const state = JSON.parse(JSON.stringify(initialState));
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
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToYearlyNudgeBanner/>
            </Provider>,
        );

        expect(wrapper.find('AlertBanner').exists()).toBe(false);
    });
});
