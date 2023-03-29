// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {CloudProducts} from 'utils/constants';

import {ToPaidNudgeBanner, ToPaidPlanBannerDismissable} from './to_paid_plan_nudge_banner';

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
                FeatureFlagEnableCloudFreeDeprecationUI: 'true',
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

describe('ToPaidPlanBannerDismissable', () => {
    test('should only show for admins on cloud free', () => {
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
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToPaidPlanBannerDismissable/>
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

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToPaidPlanBannerDismissable/>
            </Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toBe(false);
    });

    test('should NOT show for admins on cloud pro', () => {
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
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToPaidPlanBannerDismissable/>
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
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToPaidPlanBannerDismissable/>
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
                'to_paid_plan_nudge--nudge_to_paid_plan_snoozed': {
                    category: 'to_paid_plan_nudge',
                    name: 'nudge_to_paid_plan_snoozed',
                    value: '{"range": 0, "show": false}',
                },
            },
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

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToPaidPlanBannerDismissable/>
            </Provider>,
        );

        expect(wrapper.find('AnnouncementBar').exists()).toBe(false);
    });
});

describe('ToPaidNudgeBanner', () => {
    test('should show only for cloud free', () => {
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
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToPaidNudgeBanner/>
            </Provider>,
        );

        expect(wrapper.find('AlertBanner').exists()).toBe(true);
    });

    test('should NOT show for cloud professional', () => {
        const state = JSON.parse(JSON.stringify(initialState));
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
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToPaidNudgeBanner/>
            </Provider>,
        );

        expect(wrapper.find('AlertBanner').exists()).toBe(false);
    });

    test('should NOT show for cloud enterprise', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_ent',
                is_free_trial: 'false',
                trial_end_at: 1,
            },
            products: {
                prod_ent: {
                    id: 'prod_ent',
                    sku: CloudProducts.ENTERPRISE,
                },
            },
        };

        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ToPaidNudgeBanner/>
            </Provider>,
        );

        expect(wrapper.find('AlertBanner').exists()).toBe(false);
    });
});
