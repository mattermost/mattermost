// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {CloudLinks, HostedCustomerLinks} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import BillingHistory, {NoBillingHistorySection} from './billing_history';

const NO_INVOICES_LEGEND = 'All of your invoices will be shown here';

const invoiceA = TestHelper.getInvoiceMock({
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
            period_end: 1642330466000,
            period_start: 1643540066000,
        },
    ],
});
const invoiceB = TestHelper.getInvoiceMock({
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
            period_end: 1642330466000,
            period_start: 1643540066000,
        },
    ],
});

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

    test('should match the default state of the component with given props', () => {
        renderWithContext(
            <BillingHistory/>,
            state,
        );

        expect(screen.queryByText('Billing History')).toBeInTheDocument();
        expect(screen.queryByText('Transactions')).toBeInTheDocument();
        expect(screen.queryByText('All of your invoices will be shown here')).toBeInTheDocument();
        expect(screen.getByTestId(invoiceA.number)).toHaveTextContent((invoiceA.total / 100.0).toString());
        expect(screen.getByTestId(invoiceB.number)).toHaveTextContent((invoiceB.total / 100.0).toString());

        expect(screen.getByTestId(invoiceA.id)).toHaveTextContent('Pending');
        expect(screen.getByTestId(invoiceB.id)).toHaveTextContent('Paid');
    });

    test('Billing history section shows template when no invoices have been emitted yet', () => {
        const noBillingHistoryState = {
            ...state,
            entities: {...state.entities, cloud: {invoices: {}, errors: {}}},
        };
        renderWithContext(
            <BillingHistory/>,
            noBillingHistoryState,
        );

        expect(screen.queryByText('Date')).not.toBeInTheDocument();
        expect(screen.queryByText('Description')).not.toBeInTheDocument();
        expect(screen.queryByText('Total')).not.toBeInTheDocument();
        expect(screen.queryByText('Status')).not.toBeInTheDocument();

        expect(screen.queryByTestId(invoiceA.number)).not.toBeInTheDocument();
        expect(screen.queryByTestId(invoiceB.number)).not.toBeInTheDocument();

        expect(screen.queryByTestId(invoiceA.id)).not.toBeInTheDocument();
        expect(screen.queryByTestId(invoiceB.id)).not.toBeInTheDocument();

        expect(screen.getByRole('link')).toHaveAttribute('href', CloudLinks.BILLING_DOCS + '?utm_source=mattermost&utm_medium=in-product-cloud&utm_content=billing_history&uid=current_user_id&sid=');
        expect(screen.getByRole('link')).toHaveTextContent('See how billing works');
        expect(screen.getByTestId('no-invoices')).toHaveTextContent(NO_INVOICES_LEGEND);
    });

    test('Billing history section shows two invoices to download', () => {
        renderWithContext(
            <BillingHistory/>,
            state,
        );

        expect(screen.queryByText('Date')).toBeInTheDocument();
        expect(screen.queryByText('Description')).toBeInTheDocument();
        expect(screen.queryByText('Total')).toBeInTheDocument();
        expect(screen.queryByText('Status')).toBeInTheDocument();

        expect(screen.getAllByTestId('billingHistoryTableRow')).toHaveLength(2);
    });

    test('Billing history section download button has the target property set as _self so it works well in desktop app', () => {
        renderWithContext(
            <BillingHistory/>,
            state,
        );

        expect(screen.getByTestId(`billingHistoryLink-${invoiceA.id}`)).toHaveAttribute('target', '_self');
        expect(screen.getByTestId(`billingHistoryLink-${invoiceB.id}`)).toHaveAttribute('target', '_self');
        expect(screen.getByTestId(`billingHistoryLink-${invoiceA.id}`)).toHaveAttribute('href', '/api/v4/cloud/subscription/invoices/in_1KNb3DI67GP2qpb4ueaJYBt8/pdf');
        expect(screen.getByTestId(`billingHistoryLink-${invoiceB.id}`)).toHaveAttribute('href', '/api/v4/cloud/subscription/invoices/in_1KIWNTI67GP2qpb4KjGj1KAy/pdf');
    });
});

describe('NoBillingHistorySection', () => {
    const state = {entities: {users: {}, general: {config: {}, license: {}}}} as any;
    test('goes to cloud docs on cloud', () => {
        renderWithContext(
            <NoBillingHistorySection selfHosted={false}/>,
            state,
        );
        expect((screen.getByRole('link') as HTMLAnchorElement).href).toContain(CloudLinks.BILLING_DOCS);
    });

    test('goes to self-hosted docs on self-hosted', () => {
        renderWithContext(
            <NoBillingHistorySection selfHosted={true}/>,
            state,
        );
        expect((screen.getByRole('link') as HTMLAnchorElement).href).toContain(HostedCustomerLinks.SELF_HOSTED_BILLING);
    });
});

