// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithIntlAndStore} from 'tests/react_testing_utils';
import * as cloudActions from 'mattermost-redux/actions/cloud';

import {CloudProducts} from 'utils/constants';

import PaymentAnnouncementBar from './';

jest.mock('mattermost-redux/actions/cloud', () => {
    const original = jest.requireActual('mattermost-redux/actions/cloud');
    return {
        ...original,
        __esModule: true,

        // just testing that it fired, not that the result updated or anything like that
        getCloudCustomer: jest.fn(() => ({type: 'bogus'})),
    };
});

describe('PaymentAnnouncementBar', () => {
    const happyPathStore = {
        entities: {
            users: {
                currentUserId: 'me',
                profiles: {
                    me: {
                        roles: 'system_admin',
                    },
                },
            },
            general: {
                license: {
                    Cloud: 'true',
                },
            },
            cloud: {
                subscription: {
                    product_id: 'prod_something',
                    last_invoice: {
                        status: 'failed',
                    },
                },
                customer: {
                    payment_method: {
                        exp_month: 12,
                        exp_year: (new Date()).getFullYear() + 1,
                    },
                },
                products: {
                    prod_something: {
                        id: 'prod_something',
                        sku: CloudProducts.PROFESSIONAL,
                    },
                },
            },
        },
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
    };

    it('when most recent payment failed, shows that', () => {
        renderWithIntlAndStore(<PaymentAnnouncementBar/>, happyPathStore);
        screen.getByText('Your most recent payment failed');
    });

    it('when card is expired, shows that', () => {
        const store = JSON.parse(JSON.stringify(happyPathStore));
        store.entities.cloud.customer.payment_method.exp_year = (new Date()).getFullYear() - 1;
        store.entities.cloud.subscription.last_invoice.status = 'success';
        renderWithIntlAndStore(<PaymentAnnouncementBar/>, store);
        screen.getByText('Your credit card has expired', {exact: false});
    });

    it('when needed, fetches, customer', () => {
        const store = JSON.parse(JSON.stringify(happyPathStore));
        store.entities.cloud.customer = null;
        store.entities.cloud.subscription.last_invoice.status = 'success';
        renderWithIntlAndStore(<PaymentAnnouncementBar/>, store);
        expect(cloudActions.getCloudCustomer).toHaveBeenCalled();
    });

    it('when not an admin, does not fetch customer', () => {
        const store = JSON.parse(JSON.stringify(happyPathStore));
        store.entities.users.profiles.me.roles = '';
        renderWithIntlAndStore(<PaymentAnnouncementBar/>, store);
        expect(cloudActions.getCloudCustomer).not.toHaveBeenCalled();
    });
});
