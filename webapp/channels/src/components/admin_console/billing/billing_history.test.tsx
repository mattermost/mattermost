// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Provider} from 'react-redux';

import {shallow} from 'enzyme';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import BillingHistory from './billing_history';

const NO_INVOICES_LEGEND = 'All of your invoices will be shown here';

const invoiceA = {
    id: 'in_1KNb3DI67GP2qpb4ueaJYBt8',
    number: '87030375-0015',
    create_at: 1643540071000,
    total: 1000,
    tax: 0,
    status: 'open',
    description: '',
    period_start: 1642330466000,
    period_end: 1643540066000,
    subscription_id: 'sub_1KIWNTI67GP2qpb49XXiEscG',
    line_items: [
        {
            price_id: 'price_1JMAbZI67GP2qpb4ADjRJwYa',
            total: 1000,
            quantity: 1,
            price_per_unit: 1000,
            description:
                                    '1 × Cloud Professional (at $10.00 / month)',
            type: 'onpremise',
            metadata: {},
        },
    ],
};
const invoiceB = {
    id: 'in_1KIWNTI67GP2qpb4KjGj1KAy',
    number: '87030375-0013',
    create_at: 1642330467000,
    total: 0,
    tax: 0,
    status: 'paid',
    description: '',
    period_start: 1642330466000,
    period_end: 1642330466000,
    subscription_id: 'sub_1KIWNTI67GP2qpb49XXiEscG',
    line_items: [
        {
            price_id: 'price_1JMAbZI67GP2qpb4ADjRJwYa',
            total: 0,
            quantity: 1,
            price_per_unit: 1000,
            description:
                                    'Trial period for Cloud Professional',
            type: 'onpremise',
            metadata: {},
        },
    ],
};

describe('components/admin_console/billing/billing_history', () => {
    // required state to mount using the provider
    const state = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
                config: {
                    DiagnosticsEnabled: 'false',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_role'},
                },
            },
            cloud: {
                errors: {},
                invoices: {
                    in_1KNb3DI67GP2qpb4ueaJYBt8: invoiceA,
                    in_1KIWNTI67GP2qpb4KjGj1KAy: invoiceB,
                },
            },
        },
        views: {},
    };

    const store = mockStore(state);

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <BillingHistory/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('Billing history section shows template when no invoices have been emitted yet', () => {
        const noBillingHistoryState = {
            ...state,
            entities: {...state.entities, cloud: {invoices: {}, errors: {}}},
        };
        const storeNoBillingHistory = mockStore(noBillingHistoryState);
        const wrapper = mountWithIntl(
            <Provider store={storeNoBillingHistory}>
                <BillingHistory/>
            </Provider>,
        );

        const legend = wrapper.find(
            '.BillingHistory__cardHeaderText-bottom span',
        );
        expect(legend.text()).toBe(NO_INVOICES_LEGEND);
    });

    test('Billing history section shows two invoices to download', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BillingHistory/>
            </Provider>,
        );

        const invoiceTableRows = wrapper.find('table.BillingHistory__table tr.BillingHistory__table-row');

        expect(invoiceTableRows.length).toBe(2);
    });

    test('Billing history section download button has the target property set as _self so it works well in desktop app', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BillingHistory/>
            </Provider>,
        );

        const invoiceTableRow = wrapper.find('table.BillingHistory__table tr.BillingHistory__table-row').at(0);

        const downloadLink = invoiceTableRow.find('td.BillingHistory__table-invoice a');

        expect(downloadLink.prop('target')).toBe('_self');
    });
});

describe('BillingHistory -- self-hosted', () => {
    // required state to mount using the provider
    const state = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'false',
                },
                config: {
                    DiagnosticsEnabled: 'false',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_role'},
                },
            },
            hostedCustomer: {
                errors: {},
                invoices: {
                    invoices: {
                        in_1KNb3DI67GP2qpb4ueaJYBt8: invoiceA,
                        in_1KIWNTI67GP2qpb4KjGj1KAy: invoiceB,
                    },
                    invoicesLoaded: true,
                },
            },
        },
        views: {},
    };

    test('Billing history section shows template when no invoices have been emitted yet', () => {
        const noBillingHistoryState = {
            ...state,
            entities: {...state.entities, hostedCustomer: {invoices: {invoices: {}, invoicesLoaded: true}, errors: {}}},
        };
        const storeNoBillingHistory = mockStore(noBillingHistoryState);
        const wrapper = mountWithIntl(
            <Provider store={storeNoBillingHistory}>
                <BillingHistory/>
            </Provider>,
        );

        const legend = wrapper.find(
            '.BillingHistory__cardHeaderText-bottom span',
        );
        expect(legend.text()).toBe(NO_INVOICES_LEGEND);
    });

    test('Billing history section shows two invoices to download', () => {
        const store = mockStore(state);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BillingHistory/>
            </Provider>,
        );

        const invoiceTableRows = wrapper.find('table.BillingHistory__table tr.BillingHistory__table-row');

        expect(invoiceTableRows.length).toBe(2);
    });
});
