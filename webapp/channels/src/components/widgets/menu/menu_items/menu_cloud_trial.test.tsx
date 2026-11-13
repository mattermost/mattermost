// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';

import MenuCloudTrial from './menu_cloud_trial';

const usage = {
    files: {
        totalStorage: 0,
        totalStorageLoaded: true,
    },
    messages: {
        history: 0,
        historyLoaded: true,
    },
    boards: {
        cards: 0,
        cardsLoaded: true,
    },
    integrations: {
        enabled: 0,
        enabledLoaded: true,
    },
    teams: {
        active: 0,
        cloudArchived: 0,
        teamsLoaded: true,
    },
};

const limits = {
    limitsLoaded: true,
    limits: {
        integrations: {
            enabled: 5,
        },
        messages: {
            history: 10000,
        },
        files: {
            total_storage: FileSizes.Gigabyte,
        },
        teams: {
            active: 1,
            teamsLoaded: true,
        },
        boards: {
            cards: 500,
            views: 5,
        },
    },
};

const users = {
    currentUserId: 'uid',
    profiles: {
        uid: {},
    },
};

describe('components/widgets/menu/menu_items/menu_cloud_trial', () => {
    test('should render when on cloud license and during free trial period', () => {
        const FOURTEEN_DAYS = 1209600000; // in milliseconds
        const subscriptionCreateAt = Date.now();
        const subscriptionEndAt = subscriptionCreateAt + FOURTEEN_DAYS;
        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        trial_end_at: subscriptionEndAt,
                    },
                    limits,
                },
                usage,
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
            },
        };
        const {container} = renderWithContext(<MenuCloudTrial id='menuCloudTrial'/>, state);
        expect(container.querySelector('.MenuCloudTrial')).not.toBeNull();
    });

    test('should NOT render when NOT on cloud license and NOT during free trial period', () => {
        const state = {
            entities: {
                users,
                general: {
                    license: {
                        IsLicensed: 'false',
                    },
                },
                cloud: {
                    limits,
                },
                usage,
            },
        };
        const {container} = renderWithContext(<MenuCloudTrial id='menuCloudTrial'/>, state);
        expect(container.querySelector('.MenuCloudTrial')).toBeNull();
    });

    test('should NOT render when NO license is available', () => {
        const state = {
            entities: {
                users,
                general: {},
                cloud: {
                    limits,
                },
                usage,
            },
        };
        const {container} = renderWithContext(<MenuCloudTrial id='menuCloudTrial'/>, state);
        expect(container.querySelector('.MenuCloudTrial')).toBeNull();
    });

    test('should NOT render when is cloud and not on a trial', () => {
        const state = {
            entities: {
                users,
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        trial_end_at: 0,
                    },
                    limits,
                },
                usage,
            },
        };
        const {container} = renderWithContext(<MenuCloudTrial id='menuCloudTrial'/>, state);
        expect(container.querySelector('.open-learn-more-trial-modal')).toBeNull();
        expect(container.querySelector('.MenuCloudTrial')).toBeNull();
    });

    test('should show the open trial benefits modal when is free trial', () => {
        const state = {
            entities: {
                users,
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                cloud: {
                    subscription: {
                        product_id: 'prod_starter',
                        is_free_trial: 'true',
                        trial_end_at: 12345,
                    },
                    products: {
                        prod_starter: {
                            id: 'prod_starter',
                            sku: CloudProducts.STARTER,
                        },
                    },
                    limits,
                },
                usage,
            },
        };
        const {container} = renderWithContext(<MenuCloudTrial id='menuCloudTrial'/>, state);
        const openModalLink = container.querySelector('.open-trial-benefits-modal');
        expect(openModalLink).not.toBeNull();
        expect(openModalLink?.textContent).toBe('Learn more');
    });

    test('should show the invitation to open the trial benefits modal when is End User and is in TRIAL', () => {
        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        trial_end_at: 0,
                        product_id: 'prod_starter',
                    },
                    products: {
                        prod_starter: {
                            id: 'prod_starter',
                            sku: CloudProducts.STARTER,
                        },
                    },
                    limits,
                },
                usage,
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {roles: 'system_user'},
                    },
                },
            },
        };
        const {container} = renderWithContext(<MenuCloudTrial id='menuCloudTrial'/>, state);
        const openModalLink = container.querySelector('.open-trial-benefits-modal');
        expect(openModalLink).not.toBeNull();
        expect(openModalLink?.textContent).toEqual('Learn more');
    });

    test('should NOT show the menu cloud trial when is End User and is NOT in TRIAL', () => {
        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        trial_end_at: 12345,
                        product_id: 'prod_starter',
                    },
                    products: {
                        prod_starter: {
                            id: 'prod_starter',
                            sku: CloudProducts.STARTER,
                        },
                    },
                    limits,
                },
                usage,
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {roles: 'system_user'},
                    },
                },
            },
        };
        const {container} = renderWithContext(<MenuCloudTrial id='menuCloudTrial'/>, state);
        const openModalLink = container.querySelector('.open-trial-benefits-modal');
        expect(openModalLink).toBeNull();
    });
});
