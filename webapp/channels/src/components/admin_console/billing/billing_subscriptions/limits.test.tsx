// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {screen} from '@testing-library/react';

import * as redux from 'react-redux';
import {Provider} from 'react-redux';

import {renderWithIntl} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import * as cloudActions from 'actions/cloud';

import {FileSizes} from 'utils/file_utils';
import {Constants, CloudProducts} from 'utils/constants';

import {UserProfile, UsersState} from '@mattermost/types/users';
import {GlobalState} from '@mattermost/types/store';

import {Subscription, Product} from '@mattermost/types/cloud';

import Limits from './limits';

const freeLimits = {
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
};

interface SetupOptions {
    isEnterprise?: boolean;
}
function setupStore(setupOptions: SetupOptions) {
    const state = {
        entities: {
            cloud: {
                limits: {
                    limitsLoaded: !setupOptions.isEnterprise,
                    limits: setupOptions.isEnterprise ? {} : freeLimits,
                },
                subscription: {
                    product_id: setupOptions.isEnterprise ? 'prod_enterprise' : 'prod_free',
                } as Subscription,
                products: {
                    prod_free: {
                        id: 'prod_free',
                        name: 'Cloud Free',
                        sku: CloudProducts.STARTER,
                    } as Product,
                    prod_enterprise: {
                        id: 'prod_enterprise',
                        name: 'Cloud Enterprise',
                        sku: CloudProducts.ENTERPRISE,
                    } as Product,
                } as Record<string, Product>,
            },
            usage: {
                files: {
                    totalStorage: 0,
                    totalStorageLoaded: true,
                },
                messages: {
                    history: 0,
                    historyLoaded: true,
                },
                teams: {
                    active: 0,
                    cloudArchived: 0,
                    teamsLoaded: true,
                },
            },
            admin: {
                analytics: {
                    [Constants.StatTypes.TOTAL_POSTS]: 1234,
                } as GlobalState['entities']['admin']['analytics'],
            },
            users: {
                currentUserId: 'userid',
                profiles: {
                    userid: {} as UserProfile,
                },
            } as unknown as UsersState,
            general: {
                license: {},
                config: {},
            },
        },
    } as GlobalState;
    if (setupOptions.isEnterprise) {
        state.entities.cloud.subscription!.is_free_trial = 'true';
    }
    const store = mockStore(state);

    return store;
}

describe('Limits', () => {
    const defaultOptions = {};
    test('message limit rendered in K', () => {
        const store = setupStore(defaultOptions);

        renderWithIntl(<Provider store={store}><Limits/></Provider>);
        screen.getByText('Message History');
        screen.getByText(/of 10K/);
    });

    test('storage limit rendered in GB', () => {
        const store = setupStore(defaultOptions);

        renderWithIntl(<Provider store={store}><Limits/></Provider>);
        screen.getByText('File Storage');
        screen.getByText(/of 1GB/);
    });

    test('renders nothing if on enterprise', () => {
        const mockGetLimits = jest.fn();
        jest.spyOn(cloudActions, 'getCloudLimits').mockImplementation(mockGetLimits);
        jest.spyOn(redux, 'useDispatch').mockImplementation(jest.fn(() => jest.fn()));
        const store = setupStore({isEnterprise: true});

        renderWithIntl(<Provider store={store}><Limits/></Provider>);
        expect(screen.queryByTestId('limits-panel-title')).not.toBeInTheDocument();
    });

    test('renders elements if not on enterprise', () => {
        const mockGetLimits = jest.fn();
        jest.spyOn(cloudActions, 'getCloudLimits').mockImplementation(mockGetLimits);
        jest.spyOn(redux, 'useDispatch').mockImplementation(jest.fn(() => jest.fn()));
        const store = setupStore(defaultOptions);

        renderWithIntl(<Provider store={store}><Limits/></Provider>);
        screen.getByTestId('limits-panel-title');
    });
});
