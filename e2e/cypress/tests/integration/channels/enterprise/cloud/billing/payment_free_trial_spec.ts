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
}

describe('System Console - Payment Information section', () => {
    before(() => {
        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');
        simulateSubscription();

        // # Visit Subscription page
        cy.visit('/admin_console/billing/subscription');

        // * Check for Subscription header
        cy.contains('.admin-console__header', 'Subscription').should('be.visible');
    });

    it('MM-T4120 Validate non existence of Payment Information menu should during the trial period', () => {
        // * Check for visibility of payment information menu
        cy.get('#billing\\/payment_info', {timeout: 10000}).should('not.exist');
    });

    it('MM-T5207 should validate admin user is able to submit alternative payment option', () => {
        cy.intercept('PUT', '/api/v4/cloud/customer', {
            body: {
                name: '',
                email: 'user123@example.mattermost.com',
                num_employees: 0,
                monthly_subscription_intent_wire_transfer: '',
                id: 'uniqueID',
                creator_id: '123randomId',
                create_at: 1665763513000,
                first_purchase_alt_payment_method: '{"ach":false,"wire":false,"other":true,"otherPaymentOption":"Test Payment Option"}',
                billing_address: {city: '',
                    country: '',
                    line1: '',
                    line2: '',
                    postal_code: '',
                    state: ''},
                company_address: {city: '',
                    country: '',
                    line1: '',
                    line2: '',
                    postal_code: '',
                    state: ''},
                payment_method: {type: '',
                    last_four: '',
                    exp_month: 0,
                    exp_year: 0,
                    card_brand: '',
                    name: ''},
            }}).as('feedbackResponse');
        cy.get('.UpgradeMattermostCloud__upgradeButton').click();
        cy.get('button#monthlySubscription').as('paymentFeedbackLink').should('be.visible').should('have.text', 'Looking for other payment options?').click();
        cy.get('.Form-section-title').should('be.visible');
        cy.get('input#wire').should('be.not.checked');
        cy.get('input#ach').should('be.not.checked');
        cy.get('input#other').should('be.not.checked');
        cy.get('button#cancelFeedback').should('be.enabled').click();
        cy.get('@paymentFeedbackLink').click();
        cy.get('button#submitFeedback').should('be.disabled');

        cy.get('input#wire').as('wireOption').check();
        cy.get('button#submitFeedback').as('savebutton').should('be.enabled');
        cy.get('@wireOption').check();

        cy.get('@savebutton').should('be.enabled').click();
        cy.wait('@feedbackResponse');
        cy.get('span.savedFeedback__text').should('be.visible').should('have.text', 'Thanks for sharing feedback!');
        cy.get('button#feedbackSubmitedDone').should('be.enabled').click();
    });
});

