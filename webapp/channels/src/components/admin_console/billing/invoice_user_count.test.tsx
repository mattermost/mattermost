// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {InvoiceLineItemType} from '@mattermost/types/cloud';
import type {Invoice} from '@mattermost/types/cloud';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import InvoiceUserCount from './invoice_user_count';

function makeInvoice(...lines: Array<[number, typeof InvoiceLineItemType[keyof typeof InvoiceLineItemType]]>): Invoice {
    return {
        id: '',
        current_product_name: '',
        number: '',
        create_at: 0,
        total: 0,
        tax: 0,
        status: '',
        description: '',
        period_start: 0,
        period_end: 0,
        subscription_id: '',
        line_items: lines.map(([quantity, type], index) => {
            const lineItem = {
                price_id: `price_${index}`,
                total: 0,
                quantity,
                price_per_unit: 0,
                description: '',
                type,
                metadata: {} as Record<string, string>,
            };
            if (type === InvoiceLineItemType.Full || type === InvoiceLineItemType.Partial) {
                lineItem.metadata.type = type;
                lineItem.metadata.quantity = 'quantity';
                lineItem.metadata.unit_amount_decimal = '123';
            }
            return lineItem;
        }),
    };
}

describe('InvoiceUserCount', () => {
    const tests = [
        {
            name: 'Supports cloud invoices with metered and non-metered line items',
            invoice: makeInvoice(
                [1, InvoiceLineItemType.Metered],
                [1, InvoiceLineItemType.Full],
                [1, InvoiceLineItemType.Partial],
            ),
            expected: '1 metered seats, 1 seats at full rate, 1 seats with partial charges',
        },
        {
            name: 'Supports cloud invoices with only metered line items',
            invoice: makeInvoice(
                [12.34, InvoiceLineItemType.Metered],
            ),
            expected: '12.34 seats',
        },
        {
            name: 'Shows minimum decimal necessary',
            invoice: makeInvoice(
                [12.499, InvoiceLineItemType.Metered],
            ),
            expected: '12.5 seats',
        },
        {
            name: 'hides insignificant decimals',
            invoice: makeInvoice(
                [12.002, InvoiceLineItemType.Metered],
            ),
            expected: '12 seats',
        },
        {
            name: 'Supports cloud invoices with only non-metered line items',
            invoice: makeInvoice(
                [1, InvoiceLineItemType.Full],
                [249, InvoiceLineItemType.Partial],
            ),
            expected: '1 seats at full rate, 249 seats with partial charges',
        },
        {
            name: 'Shows default of 0 full users, 0 partial users when there are no users',
            invoice: makeInvoice(
                [0, InvoiceLineItemType.Metered],
                [0, InvoiceLineItemType.Full],
                [0, InvoiceLineItemType.Partial],
            ),
            expected: '0 seats at full rate, 0 seats with partial charges',
        },
        {
            name: 'Shows default of 0 full users, 0 partial users when there are no line items in invoice',
            invoice: makeInvoice(),
            expected: '0 seats at full rate, 0 seats with partial charges',
        },
        {
            name: 'Shows 3 full userswhen there are on prem users',
            invoice: makeInvoice(
                [3, InvoiceLineItemType.OnPremise],
            ),
            expected: '3 seats',
        },
    ];

    tests.forEach(({name, invoice, expected}) => {
        it(name, () => {
            const wrapper = mountWithIntl(<InvoiceUserCount invoice={invoice}/>);
            expect(wrapper.text()).toBe(expected);
        });
    });
});
