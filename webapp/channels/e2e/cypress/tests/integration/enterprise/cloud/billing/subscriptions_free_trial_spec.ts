// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @cloud_only @cloud_trial

import billing from '../../../../fixtures/client_billing.json';

function simulateSubscription() {
    cy.intercept('GET', '**/api/v4/cloud/subscription', {
        statusCode: 200,
        body: {
            id: 'sub_test1',
            is_free_trial: 'true',
            customer_id: '5zqhakmibpgyix9juiwwkpfnmr',
            product_id: 'prod_Jh6tBLcgWWOOog',
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

    cy.intercept('GET', '**/api/v4/cloud/customer', {
        statusCode: 200,
        body: {
            name: 'Test environment ',
            email: 'test.mattermost.com@mattermost.com',
            num_employees: 12,
            monthly_subscription_alt_payment_method: '',
            id: 'oip7khhhkpbk7cjkrf7m66qyas',
            creator_id: 'iq9xcutqp7bpdramcij939yas',
            create_at: 1661456270000,
            billing_address: {
                city: 'Seattle',
                country: 'United States',
                line1: '123 Hello',
                line2: '',
                postal_code: '38383',
                state: 'AK',
            },
            company_address: {
                city: '',
                country: '',
                line1: '',
                line2: '',
                postal_code: '',
                state: '',
            },
            payment_method: {
                type: 'card',
                last_four: '4242',
                exp_month: 4,
                exp_year: 2028,
                card_brand: 'visa',
                name: '',
            },
        },
    });
}

describe('System Console - Subscriptions section', () => {
    before(() => {
        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');
    });

    beforeEach(() => {
        simulateSubscription();

        // # Visit Subscription page
        cy.visit('/admin_console/billing/subscription');
    });

    it('MM-T4118 Subscription page UI check', () => {
        // * Check for Subscription header
        cy.contains('.admin-console__header', 'Subscription').should('be.visible');

        // * Check for visibility of Trial tag
        cy.contains('span', 'trial', {timeout: 10000}).should('be.visible');

        // * Check for User count
        cy.request('/api/v4/analytics/old?name=standard&team_id=').then((response) => {
            cy.get('.PlanDetails__userCount > span').invoke('text').then((text) => {
                const userCount = response.body.find((obj) => obj.name === 'unique_user_count');
                expect(text).to.contain(userCount.value);
            });
        });

        // * Check for See how billing works navigation
        cy.contains('span', 'See how billing works').parent().then((link) => {
            const getHref = () => link.prop('href');
            cy.wrap({href: getHref}).invoke('href').should('contains', '/cloud-billing.html');
            cy.wrap(link).should('have.attr', 'target', '_blank');
            cy.wrap(link).should('have.attr', 'rel', 'noopener noreferrer');
            cy.request(link.prop('href')).its('status').should('eq', 200);
        });
    });

    it('MM-T4122 "Upgrade now" navigation and closing of Upgrade window', () => {
        // # Click on Upgrade Now button
        cy.contains('span', 'Upgrade Now').parent().click();
        cy.get('#professional_action').click();

        // * Check for "Provide Your Payment Details" label
        cy.findByText('Provide your payment details').should('be.visible');

        // # Click on close button of Upgrade window
        cy.get('#closeIcon').parent().should('exist').click();

        // * Check for "Your trial has started!" label
        cy.contains('span', 'Your trial has started!').should('be.visible');
    });

    it('MM-T4124 Purchase modal UI check', () => {
        // # Click on Upgrade Now button
        cy.contains('span', 'Upgrade Now').parent().click();

        cy.get('#professional_action').click();

        // * Check for "Provide Your Payment Details" label
        cy.findByText('Provide your payment details').should('be.visible');

        // * Check for Compare plans navigation
        cy.contains('span', 'Compare plans').click();

        cy.findByRole('heading', {name: 'Select a plan'}).should('be.visible');
        cy.findByRole('button', {name: 'Close'}).click();

        // * Check for See how billing works navigation
        cy.contains('span', 'See how billing works').should('be.visible');
    });

    it('MM-T4128 Enable/disable "Upgrade" button in Purchase modal', () => {
        // # Click on Upgrade Now button
        cy.contains('span', 'Upgrade Now').parent().click();

        // # Click on Upgrade Now button on plans modal
        cy.get('#professional_action').click();

        // * Check for "Provide your payment details" label
        cy.findByText('Provide your payment details').should('be.visible');

        // # Enter card details
        cy.uiGetPaymentCardInput().within(() => {
            cy.get('[name="cardnumber"]').should('be.enabled').clear().type(billing.visa.cardNumber);
            cy.get('[name="exp-date"]').should('be.enabled').clear().type(billing.visa.expDate);
            cy.get('[name="cvc"]').should('be.enabled').clear().type(billing.visa.cvc);
        });
        cy.get('#input_name').clear().type('test name');
        cy.findByText('Country').parent().find('.icon-chevron-down').click();
        cy.findByText('Country').parent().find("input[type='text']").type('India{enter}', {force: true});
        cy.get('#input_address').type('test1');
        cy.get('#input_address2').type('test2');
        cy.get('#input_city').clear().type('testcity');
        cy.get('#input_state').type('test');
        cy.get('#input_postalCode').type('444');

        // * Check for enable status of Upgrade button
        cy.get('.RHS').find('button').should('be.enabled');

        // # Enter invalid csv
        cy.uiGetPaymentCardInput().within(() => {
            cy.get('[name="cvc"]').clear().type(billing.invalidvisa.cvc);
        });
        cy.get('#input_name').clear().type('test user');
        cy.get('.RHS').find('button').should('be.disabled');

        // # Enter billing details
        cy.findByText('Country').parent().find('.icon-chevron-down').click();
        cy.findByText('Country').parent().find("input[type='text']").type('India{enter}', {force: true});
        cy.get('.RHS').find('button').should('be.disabled');
        cy.get('#input_address').type('test1');
        cy.get('#input_address2').type('test2');
        cy.get('#input_city').clear().type('testcity');
        cy.get('.RHS').find('button').should('be.disabled');
        cy.get('#input_state').type('test');
        cy.get('.RHS').find('button').should('be.disabled');
        cy.get('#input_postalCode').type('444');

        // # Enter invalid card details
        cy.uiGetPaymentCardInput().within(() => {
            cy.get('[name="cardnumber"]').should('be.enabled').clear().type(billing.invalidvisa.cardNumber);
            cy.get('[name="exp-date"]').should('be.enabled').clear().type(billing.visa.expDate);
            cy.get('[name="cvc"]').should('be.enabled').clear().type(billing.visa.cvc);
        });
        cy.get('#input_name').clear().type('test user');

        // * Check for disabled Upgrade button for having wrong card details
        cy.get('.RHS').find('button').should('be.disabled');
    });
});
