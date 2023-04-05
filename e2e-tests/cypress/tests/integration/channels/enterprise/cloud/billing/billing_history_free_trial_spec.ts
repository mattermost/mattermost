// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @cloud_only @cloud_trial

function simulateSubscription() {
    cy.intercept('GET', '**/api/v4/cloud/subscription/invoices', {
        statusCode: 200,
        body: [
            {
                id: 'in_1Lz8b0I67GP2qpb43kcuMyFP',
                number: '8D53267B-0006',
                create_at: 1667263490000,
                total: 65,
                tax: 0,
                status: 'open',
                description: '',
                period_start: 1664582400000,
                period_end: 1667260800000,
                subscription_id: 'sub_K0AxuWCDoDD9Qq',
                line_items: [
                    {
                        price_id: 'price_1KLUYiI67GP2qpb48DXFukcJ',
                        total: 65,
                        quantity: 0.06451612903225806,
                        price_per_unit: 1000,
                        description: 'Cloud Professional',
                    },
                ],
                current_product_name: 'Cloud Professional',
            },
            {
                id: 'in_1LntnKI67GP2qpb4VObu3NgP',
                number: '8D53267B-0005',
                create_at: 1664584986000,
                total: 733,
                tax: 0,
                status: 'failed',
                description: '',
                period_start: 1661990400000,
                period_end: 1664582400000,
                subscription_id: 'sub_K0AxuWCDoDD9Qq',
                line_items: [
                    {
                        price_id: 'price_1KLUZ2I67GP2qpb45uTS89eb',
                        total: 733,
                        quantity: 0.7333333333333333,
                        price_per_unit: 999,
                        description: 'Cloud Professional',
                    },
                ],
                current_product_name: 'Cloud Professional',
            },
            {
                id: 'in_1LntnKI67GP2qpb4VObu3NgV',
                number: '8D53267B-0005',
                create_at: 1664584986000,
                total: 733,
                tax: 0,
                status: 'paid',
                description: '',
                period_start: 1661990400000,
                period_end: 1664582400000,
                subscription_id: 'sub_K0AxuWCDoDD9Qq',
                line_items: [
                    {
                        price_id: 'price_1KLUZ2I67GP2qpb45uTS89eb',
                        total: 733,
                        quantity: 0.7333333333333333,
                        price_per_unit: 999,
                        description: 'Cloud Professional',
                    },
                ],
                current_product_name: 'Cloud Professional',
            },
        ],
    });
    cy.intercept('GET', '**/api/v4/cloud/subscription', {
        statusCode: 200,
        body: {
            id: 'sub_test1',
            is_free_trial: 'true',
            customer_id: '5zqhakmibpgyix9juiwwkpfnmr',
            product_id: 'prod_K0AxuWCDoDD9Qq',
            seats: 25,
            status: 'active',
        },
    });

    cy.intercept('GET', '**/api/v4/cloud/products**', {
        statusCode: 200,
        body:
            [
                {
                    id: 'prod_LSBESgGXq9KlLj',
                    sku: 'cloud-starter',
                    price_per_seat: 0,
                    name: 'Cloud Free',
                },
                {
                    id: 'prod_K0AxuWCDoDD9Qq',
                    sku: 'cloud-professional',
                    price_per_seat: 10,
                    name: 'Cloud Professional',
                },
                {
                    id: 'prod_Jh6tBLcgWWOOog',
                    sku: 'cloud-enterprise',
                    price_per_seat: 30,
                    name: 'Cloud Enterprise',
                },
            ],
    });
}

describe('System Console - Billing History', () => {
    before(() => {
        simulateSubscription();

        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');

        // # Visit the billing history url
        cy.visit('admin_console/billing/billing_history');

        // * Check for billing history header
        cy.contains('.admin-console__header', 'Billing History').should('be.visible');
    });

    it('MM-T3491_1 Invoice is shown in a table', () => {
        cy.get('tr.BillingHistory__table-row').as('tableRows');

        // * Check the first row where payment is pending
        cy.get('@tableRows').eq(0).find('td').eq(0).should('have.text', '10/01/2022');
        cy.get('@tableRows').eq(0).find('td.BillingHistory__table-total').should('have.text', '$0.65');
        cy.get('@tableRows').eq(0).find('div.BillingHistory__paymentStatus').as('invoiceRecord').should('have.text', 'Pending');
        cy.get('@invoiceRecord').find('.icon-check-circle-outline').should('be.visible');

        // * Check the first row where payment has failed
        cy.get('@tableRows').eq(1).find('td').eq(0).should('have.text', '09/01/2022');
        cy.get('@tableRows').eq(1).find('td.BillingHistory__table-total').should('have.text', '$7.33');
        cy.get('@tableRows').eq(1).find('div.BillingHistory__paymentStatus').as('invoiceRecord').should('have.text', 'Payment failed');
        cy.get('@invoiceRecord').find('.icon-alert-outline').should('be.visible');

        // * Check the first row where payment was successfull
        cy.get('@tableRows').eq(2).find('td').eq(0).should('have.text', '09/01/2022');
        cy.get('@tableRows').eq(2).find('td.BillingHistory__table-total').should('have.text', '$7.33');
        cy.get('@tableRows').eq(2).find('div.BillingHistory__paymentStatus').as('invoiceRecord').should('have.text', 'Paid');
        cy.get('@invoiceRecord').find('.icon-check-circle-outline').should('be.visible');
    });

    it('MM-T3491_2 Validate the contents of downloaded PDF invoice', () => {
        cy.get('tr.BillingHistory__table-row').as('tableRows');

        // * Check for default record's length in grid
        cy.get('@tableRows').should('have.length', 3);

        // * Check the invoice line
        cy.get('@tableRows').eq(1).find('td').eq(4).find('a').should('have.attr', 'href').and('include', 'invoices/in_1LntnKI67GP2qpb4VObu3NgP/pdf');
        cy.get('@tableRows').eq(2).find('td').eq(4).find('a').should('have.attr', 'href').and('include', 'invoices/in_1LntnKI67GP2qpb4VObu3NgV/pdf');
    });
});

describe('System Console - Empty Billing Screen', () => {
    before(() => {
        cy.intercept('GET', '**/api/v4/cloud/subscription/invoices', {
            statusCode: 200,
            body: [
            ],
        });

        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');

        // # Visit the billing history url
        cy.visit('admin_console/billing/billing_history');

        // * Check for billing history header
        cy.contains('.admin-console__header', 'Billing History').should('be.visible');
    });

    it('should show empty screen picture and link to /cloud-billing.html', () => {
        cy.get('.BillingHistory__cardHeaderText-bottom').should('have.text', 'All of your invoices will be shown here');
        cy.get('.BillingHistory__noHistory-link').should('have.text', 'See how billing works').should('have.attr', 'href').and('include', 'cloud/cloud-billing/cloud-billing.html');
    });
});
