// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';

import {ToPaidPlanBannerDismissable} from './to_paid_plan_nudge_banner';

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
                FeatureFlagDeprecateCloudFree: 'true',
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

        renderWithContext(<ToPaidPlanBannerDismissable/>, state, {useMockedStore: true});

        screen.getByTestId('cloud-free-deprecation-announcement-bar');
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

        renderWithContext(<ToPaidPlanBannerDismissable/>, state, {useMockedStore: true});

        expect(() => screen.getByTestId('cloud-free-deprecation-announcement-bar')).toThrow();
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

        renderWithContext(<ToPaidPlanBannerDismissable/>, state, {useMockedStore: true});

        expect(() => screen.getByTestId('cloud-free-deprecation-announcement-bar')).toThrow();
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

        renderWithContext(<ToPaidPlanBannerDismissable/>, state, {useMockedStore: true});

        expect(() => screen.getByTestId('cloud-free-deprecation-announcement-bar')).toThrow();
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

        renderWithContext(<ToPaidPlanBannerDismissable/>, state, {useMockedStore: true});

        expect(() => screen.getByTestId('cloud-free-deprecation-announcement-bar')).toThrow();
    });
});
