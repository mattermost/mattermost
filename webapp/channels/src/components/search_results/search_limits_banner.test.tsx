// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {CloudProducts} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';
import {makeEmptyUsage} from 'utils/limits_test';

import SearchLimitsBanner from './search_limits_banner';

const usage = makeEmptyUsage();

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

const products = {
    prod_1: {
        id: 'prod_1',
        sku: CloudProducts.STARTER,
        price_per_seat: 0,
        name: 'Cloud Free',
    },
    prod_2: {
        id: 'prod_2',
        sku: CloudProducts.PROFESSIONAL,
        price_per_seat: 10,
        name: 'Cloud Professional',
    },
    prod_3: {
        id: 'prod_3',
        sku: CloudProducts.ENTERPRISE,
        price_per_seat: 30,
        name: 'Cloud Enterprise',
    },
};

describe('components/select_results/SearchLimitsBanner', () => {
    test('should NOT show banner for non cloud when doing messages search', () => {
        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'false', // not cloud
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: null,
                    products: null,
                    limits: {
                        limits: {},
                        limitsLoaded: false,
                    },
                },
                usage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><SearchLimitsBanner searchType='messages'/></Provider>);
        expect(wrapper.find('#messages_search_limits_banner').exists()).toEqual(false);
    });

    test('should NOT show banner for non cloud when doing files search', () => {
        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'false', // not cloud
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: null,
                    products: null,
                    limits: {
                        limits: {},
                        limitsLoaded: false,
                    },
                },
                usage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><SearchLimitsBanner searchType='files'/></Provider>);
        expect(wrapper.find('#files_search_limits_banner').exists()).toEqual(false);
    });

    test('should NOT show banner for cloud when doing cloud messages search for product without limits', () => {
        const aboveMessagesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveMessagesLimitUsage.messages.history = 15000; // above limit of 10k

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        product_id: 'prod_3', // enterprise
                    },
                    products,
                    limits: {
                        limits: {},
                        limitsLoaded: false,
                    },
                },
                usage: aboveMessagesLimitUsage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><SearchLimitsBanner searchType='messages'/></Provider>);
        expect(wrapper.find('#messages_search_limits_banner').exists()).toEqual(false);
    });

    test('should NOT show banner for cloud when doing cloud files search for product without limits', () => {
        const aboveMessagesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveMessagesLimitUsage.messages.history = 15000; // above limit of 10k

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        product_id: 'prod_3', // enterprise
                    },
                    products,
                    limits: {
                        limits: {},
                        limitsLoaded: false,
                    },
                },
                usage: aboveMessagesLimitUsage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><SearchLimitsBanner searchType='files'/></Provider>);
        expect(wrapper.find('#files_search_limits_banner').exists()).toEqual(false);
    });

    test('should show banner for CLOUD when doing cloud messages search above the limit in Free product', () => {
        const aboveMessagesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveMessagesLimitUsage.messages.history = 15000; // above limit of 10K

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true', // cloud
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        product_id: 'prod_1', // free
                    },
                    products,
                    limits,
                },
                usage: aboveMessagesLimitUsage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><SearchLimitsBanner searchType='messages'/></Provider>);
        expect(wrapper.find('#messages_search_limits_banner').exists()).toEqual(true);
    });

    test('should show banner for CLOUD when doing cloud files search above the limit in Free product', () => {
        const aboveFilesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveFilesLimitUsage.files.totalStorage = 1.1 * FileSizes.Gigabyte; // above limit of 1GB

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true', // cloud
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        product_id: 'prod_1', // free
                    },
                    products,
                    limits,
                },
                usage: aboveFilesLimitUsage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><SearchLimitsBanner searchType='files'/></Provider>);
        expect(wrapper.find('#files_search_limits_banner').exists()).toEqual(true);
    });

    test('should not show banner for CLOUD when doing cloud files search above the limit in PROFESSIONAL product', () => {
        const aboveFilesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveFilesLimitUsage.files.totalStorage = 1.1 * FileSizes.Gigabyte; // above limit of 1GB. This limit is higher in professional

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true', // cloud
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        product_id: 'prod_2', // professional
                    },
                    products,
                    limits: {
                        limits: {},
                        limitsLoaded: false,
                    },
                },
                usage: aboveFilesLimitUsage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><SearchLimitsBanner searchType='files'/></Provider>);
        expect(wrapper.find('#files_search_limits_banner').exists()).toEqual(false);
    });
});
