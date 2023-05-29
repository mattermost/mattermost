// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithIntlAndStore} from 'tests/react_testing_utils';
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

describe('ToYearlyNudgeBannerDismissable', () => {
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

        renderWithIntlAndStore(<ToYearlyNudgeBannerDismissable/>, state);

        screen.getByTestId('cloud-pro-monthly-deprecation-announcement-bar');
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

        renderWithIntlAndStore(<ToYearlyNudgeBannerDismissable/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-announcement-bar')).toThrow();
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

        renderWithIntlAndStore(<ToYearlyNudgeBannerDismissable/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-announcement-bar')).toThrow();
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

        renderWithIntlAndStore(<ToYearlyNudgeBannerDismissable/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-announcement-bar')).toThrow();
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
        renderWithIntlAndStore(<ToYearlyNudgeBannerDismissable/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-announcement-bar')).toThrow();
    });

    test('should NOT show for admins when banner was dismissed in preferences', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_admin'},
        };
        state.entities.preferences = {
            myPreferences: {
                'to_cloud_yearly_plan_nudge--nudge_to_cloud_yearly_plan_snoozed': {
                    category: 'to_cloud_yearly_plan_nudge',
                    name: 'nudge_to_cloud_yearly_plan_snoozed',
                    value: '{"range": 0, "show": false}',
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
        renderWithIntlAndStore(<ToYearlyNudgeBannerDismissable/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-announcement-bar')).toThrow();
    });

    test('should NOT show when subscription has billing type of internal', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_admin'},
        };
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_professional',
                is_free_trial: 'false',
                trial_end_at: 1,
                billing_type: 'internal',
            },
            products: {
                prod_professional: {
                    id: 'prod_professional',
                    sku: CloudProducts.PROFESSIONAL,
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        renderWithIntlAndStore(<ToYearlyNudgeBannerDismissable/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-announcement-bar')).toThrow();
    });

    test('should NOT show when subscription has billing type of licensed', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles = {
            current_user_id: {roles: 'system_admin'},
        };
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_professional',
                is_free_trial: 'false',
                trial_end_at: 1,
                billing_type: 'licensed',
            },
            products: {
                prod_professional: {
                    id: 'prod_professional',
                    sku: CloudProducts.PROFESSIONAL,
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        renderWithIntlAndStore(<ToYearlyNudgeBannerDismissable/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-announcement-bar')).toThrow();
    });
});

describe('ToYearlyNudgeBanner', () => {
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

        renderWithIntlAndStore(<ToYearlyNudgeBanner/>, state);

        screen.getByTestId('cloud-pro-monthly-deprecation-alert-banner');
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

        renderWithIntlAndStore(<ToYearlyNudgeBanner/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-alert-banner')).toThrow();
    });
    test('should NOT show when subscription has billing type of internal', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_professional',
                is_free_trial: 'false',
                trial_end_at: 1,
                billing_type: 'internal',
            },
            products: {
                prod_professional: {
                    id: 'prod_professional',
                    sku: CloudProducts.PROFESSIONAL,
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        renderWithIntlAndStore(<ToYearlyNudgeBanner/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-alert-banner')).toThrow();
    });

    test('should NOT show when subscription has billing type of licensed', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud = {
            subscription: {
                product_id: 'prod_professional',
                is_free_trial: 'false',
                trial_end_at: 1,
                billing_type: 'licensed',
            },
            products: {
                prod_professional: {
                    id: 'prod_professional',
                    sku: CloudProducts.PROFESSIONAL,
                    recurring_interval: RecurringIntervals.MONTH,
                },
            },
        };

        renderWithIntlAndStore(<ToYearlyNudgeBanner/>, state);

        expect(() => screen.getByTestId('cloud-pro-monthly-deprecation-alert-banner')).toThrow();
    });
});

