// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
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
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuCloudTrial id='menuCloudTrial'/></Provider>);
        expect(wrapper.find('.MenuCloudTrial').exists()).toEqual(true);
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
                    customer: null,
                    subscription: null,
                    products: null,
                    invoices: null,
                    limits,
                },
                usage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuCloudTrial id='menuCloudTrial'/></Provider>);
        expect(wrapper.find('.MenuCloudTrial').exists()).toEqual(false);
    });

    test('should NOT render when NO license is available', () => {
        const state = {
            entities: {
                users,
                general: {},
                cloud: {
                    customer: null,
                    subscription: null,
                    products: null,
                    invoices: null,
                    limits,
                },
                usage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuCloudTrial id='menuCloudTrial'/></Provider>);
        expect(wrapper.find('.MenuCloudTrial').exists()).toEqual(false);
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
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuCloudTrial id='menuCloudTrial'/></Provider>);
        expect(wrapper.find('.open-learn-more-trial-modal').exists()).toEqual(false);
        expect(wrapper.find('.MenuCloudTrial').exists()).toEqual(false);
    });
});
