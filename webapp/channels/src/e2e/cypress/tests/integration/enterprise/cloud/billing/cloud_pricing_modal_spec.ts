// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @cloud_only @cloud_trial

function simulateSubscriptionWithLimitsUsage(subscription, withLimits = {}, postsUsed) {
    cy.intercept('GET', '**/api/v4/cloud/subscription', {
        statusCode: 200,
        body: subscription,
    }).as('subscription');

    cy.intercept('GET', '**/api/v4/cloud/products**', {
        statusCode: 200,
        body: [
            {
                id: 'prod_1',
                sku: 'cloud-starter',
                price_per_seat: 0,
                name: 'Cloud Free',
            },
            {
                id: 'prod_2',
                sku: 'cloud-professional',
                price_per_seat: 10,
                name: 'Cloud Professional',
                recurring_interval: 'month',
            },
            {
                id: 'prod_3',
                sku: 'cloud-enterprise',
                price_per_seat: 30,
                name: 'Cloud Enterprise',
                recurring_interval: 'month',
            },
        ],
    }).as('products');

    cy.intercept('GET', '**/api/v4/cloud/limits', {
        statusCode: 200,
        body: withLimits,
    });

    cy.intercept('GET', '**/api/v4/usage/posts', {
        count: postsUsed,
    });
}

function simulateSubscription(subscription, withLimits = true) {
    cy.intercept('GET', '**/api/v4/cloud/subscription', {
        statusCode: 200,
        body: subscription,
    });

    cy.intercept('GET', '**/api/v4/cloud/products**', {
        statusCode: 200,
        body: [
            {
                id: 'prod_1',
                sku: 'cloud-starter',
                price_per_seat: 0,
                recurring_interval: 'month',
                name: 'Cloud Free',
                cross_sells_to: '',
            },
            {
                id: 'prod_2',
                sku: 'cloud-professional',
                price_per_seat: 10,
                recurring_interval: 'month',
                name: 'Cloud Professional',
                cross_sells_to: 'prod_4',
            },
            {
                id: 'prod_3',
                sku: 'cloud-enterprise',
                price_per_seat: 30,
                recurring_interval: 'month',
                name: 'Cloud Enterprise',
                cross_sells_to: '',
            },
            {
                id: 'prod_4',
                sku: 'cloud-professional',
                price_per_seat: 96,
                recurring_interval: 'year',
                name: 'Cloud Professional Yearly',
                cross_sells_to: 'prod_2',
            },
        ],
    });

    if (withLimits) {
        cy.intercept('GET', '**/api/v4/cloud/limits', {
            statusCode: 200,
            body: {
                messages: {
                    history: 10000,
                },
            },
        });
    }
}

describe('Pricing modal', () => {
    let urlL;
    let nonAdminUser;

    it('should not show Upgrade button in global header for non admin users', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };
        cy.apiInitSetup().then(({user, offTopicUrl: url}) => {
            urlL = url;
            nonAdminUser = user;
            simulateSubscription(subscription);
            cy.apiLogin(user);
            cy.visit(url);
        });

        // * Check that Upgrade button does not show
        cy.get('#UpgradeButton').should('not.exist');
    });

    it('should check for ability to request upgrades for non admin users on free plans', () => {
        cy.apiLogout();
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };

        const messageHistoryLimit = 8000;
        const messagesUsed = 4000;

        const limits = {
            messages: {
                history: messageHistoryLimit,
            },
            teams: {
                active: 0,
                teamsLoaded: true,
            },
        };

        simulateSubscriptionWithLimitsUsage(subscription, limits, messagesUsed);
        cy.apiLogin(nonAdminUser);
        cy.visit(urlL);

        cy.get('#product_switch_menu').click();
        cy.get('#view_plans_cta').should('be.visible').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');
        cy.get('#pricingModal').find('.PricingModal__header').contains('Select a plan');

        // * Check that on professsional card there a button for non admin user to request upgrade
        cy.get('#pricingModal').should('be.visible');
        cy.get('#professional > .bottom > .bottom_container').find('#professional_action').should('be.enabled').should('have.text', 'Request admin to upgrade');

        // * Check that on enterprise card there a button for non admin user to request upgrade
        cy.get('#pricingModal').should('be.visible');
        cy.get('#enterprise > .bottom > .bottom_container').find('#enterprise_action').should('be.enabled').should('have.text', 'Request admin to upgrade');
    });

    it('should check for ability to request upgrades to enterprise for non admin users on professional monthly plans', () => {
        cy.apiLogout();
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };

        const messageHistoryLimit = 8000;
        const messagesUsed = 4000;

        const limits = {
            messages: {
                history: messageHistoryLimit,
            },
            teams: {
                active: 0,
                teamsLoaded: true,
            },
        };

        simulateSubscriptionWithLimitsUsage(subscription, limits, messagesUsed);
        cy.apiLogin(nonAdminUser);
        cy.visit(urlL);

        cy.get('#product_switch_menu').click();
        cy.get('#view_plans_cta').should('be.visible').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');
        cy.get('#pricingModal').find('.PricingModal__header').contains('Select a plan');

        // * Check that on professsional card there a button for non admin user to request upgrade and it's disabled
        cy.get('#pricingModal').should('be.visible');
        cy.get('.planLabel').should('have.text', 'CURRENT PLAN');
        cy.get('#professional > .bottom > .bottom_container').find('#professional_action').should('have.text', 'Request admin to upgrade').should('be.not.enabled');

        // * Check that on enterprise card there a button for non admin user to request upgrade
        cy.get('#pricingModal').should('be.visible');
        cy.get('#enterprise > .bottom > .bottom_container').find('#enterprise_action').should('be.enabled').should('have.text', 'Request admin to upgrade');
    });

    it('should not allow any requests for upgrades when on enterprise', () => {
        cy.apiLogout();
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'false',
        };

        const messageHistoryLimit = 8000;
        const messagesUsed = 4000;

        const limits = {
            messages: {
                history: messageHistoryLimit,
            },
            teams: {
                active: 0,
                teamsLoaded: true,
            },
        };

        simulateSubscriptionWithLimitsUsage(subscription, limits, messagesUsed);
        cy.apiLogin(nonAdminUser);
        cy.visit(urlL);

        cy.get('#product_switch_menu').click();
        cy.get('#view_plans_cta').should('be.visible').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');
        cy.get('#pricingModal').find('.PricingModal__header').contains('Select a plan');

        // * Check that on professsional card there a button for non admin user to request upgrade and it's disabled
        cy.get('#pricingModal').should('be.visible');
        cy.get('#professional > .bottom > .bottom_container').find('#professional_action').should('have.text', 'Request admin to upgrade').should('be.not.enabled');

        // * Check that on enterprise card there a button for non admin user to request upgrade
        cy.get('#pricingModal').should('be.visible');
        cy.get('.planLabel').should('have.text', 'CURRENT PLAN');
        cy.get('#enterprise > .bottom > .bottom_container').find('#enterprise_action').should('have.text', 'Request admin to upgrade').should('be.not.enabled');
    });

    it('should show Upgrade button in global header for admin users and free sku', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // * Check that Upgrade button shows for admins
        cy.get('#UpgradeButton').should('exist');

        // * Check for Upgrade button tooltip
        cy.get('#UpgradeButton').trigger('mouseover').then(() => {
            cy.get('#upgrade_button_tooltip').should('be.visible').contains('Only visible to system admins');
        });
    });

    it('should show Upgrade button in global header for admin users and enterprise trial sku', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'true',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // * Check that Upgrade button shows for admins
        cy.get('#UpgradeButton').should('exist');
    });

    it('should open pricing modal when Upgrade button clicked while in free sku', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');
        cy.get('#pricingModal').find('.PricingModal__header').contains('Select a plan');

        // * Check that free card Downgrade button is disabled
        cy.get('#pricingModal').should('be.visible');
        cy.get('#free > .bottom > .bottom_container').should('be.visible');
        cy.get('#free_action').should('be.disabled').contains('Downgrade');

        // * Check that professsional card Upgrade button opens purchase modal
        cy.get('#pricingModal').should('be.visible');
        cy.get('#professional > .bottom > .bottom_container').find('#professional_action').should('be.enabled').should('have.text', 'Upgrade').click();
        cy.get('.PurchaseModal').should('exist');

        // * Check that the upgrade button tooltip does not exist on the purchase modal
        cy.get('#upgrade_button_tooltip').should('not.exist');

        // * Close PurchaseModal
        cy.get('#closeIcon').click();

        // # Open pricing modal again
        cy.get('#UpgradeButton').should('exist').click();

        // * Check for contact sales CTA
        cy.get('#contact_sales_quote').contains('Contact Sales');

        // * Check that enterprise card action button shows Try free for 30 days
        cy.get('#pricingModal').should('be.visible');
        cy.get('#start_cloud_trial_btn').contains('Try free for 30 days');
    });

    it('should open pricing modal when Upgrade button clicked while in enterprise trial sku', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'true',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');
        cy.get('.PricingModal__header').contains('Select a plan');

        // * Check that free Downgrade card  button exists
        cy.get('#free > .bottom > .bottom_container').should('be.visible');
        cy.get('#free_action').contains('Downgrade');

        // * Check that professsional card Upgrade button is not disabled while on enterprise trial
        cy.get('#professional > .bottom > .bottom_container').should('be.visible');
        cy.get('#professional_action').should('not.be.disabled');

        // * Check that enterprise card action button is disabled
        cy.get('#enterprise > .bottom > .bottom_container').should('be.visible');
        cy.get('#start_cloud_trial_btn').contains('Try free for 30 days');
        cy.get('#enterprise > .bottom > .bottom_container').should('be.visible');
        cy.get('#start_cloud_trial_btn').should('be.disabled');
    });

    it('should open pricing modal when Upgrade button clicked while in post trial free sku', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
            trial_end_at: 100000000, // signifies that this subscription has trialled before
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');
        cy.get('.PricingModal__header').contains('Select a plan');

        // * Check that free card Downgrade button is disabled
        cy.get('#pricingModal').should('be.visible');
        cy.get('#free > .bottom > .bottom_container').should('be.visible');
        cy.get('#free_action').should('be.disabled').contains('Downgrade');

        // * Check that professsional card Upgrade button opens purchase modal
        cy.get('#professional > .bottom > .bottom_container').should('be.visible');
        cy.get('#professional_action').click();
        cy.get('.PricingModal__body').should('exist');

        // * Close PurchaseModal
        cy.get('button.close-x').click();

        // * Contact Sales button shows and Contact sales for quote CTA should not show
        cy.get('#UpgradeButton').should('exist').click();
        cy.get('#contact_sales_quote').should('not.exist');
        cy.get('#pricingModal').should('be.visible');
        cy.get('#enterprise > .bottom > .bottom_container').should('be.visible');
        cy.get('#enterprise_action').contains('Contact Sales');
    });

    it('should open pricing modal when Switch to Yearly is button clicked while in monthly professional', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2', //professional monthly
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');

        // * Check that professsional card Switch to Yearly button opens purchase modal
        cy.get('#pricingModal').should('be.visible');
        cy.get('.planLabel').should('have.text', 'CURRENTLY ON MONTHLY BILLING');
        cy.get('#professional > .bottom > .bottom_container').find('#professional_action').should('be.enabled').should('have.text', 'Switch to annual billing').click();
        cy.get('.PurchaseModal').should('exist');
    });

    it('should have Upgrade button disabled while in yearly professional', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_4', //professional yearly
            is_free_trial: 'false',
        };
        simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');

        // * Check that professsional card Switch to Yearly button opens purchase modal
        cy.get('#pricingModal').should('be.visible');
        cy.get('.planLabel').should('have.text', 'CURRENT PLAN');
        cy.get('#professional > .bottom > .bottom_container').find('#professional_action').should('not.be.enabled').should('have.text', 'Upgrade');
    });

    it('should open cloud limits modal when free disclaimer CTA is clicked', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
            trial_end_at: 100000000, // signifies that this subscription has trialled before
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');
        cy.get('.PricingModal__header').contains('Select a plan');

        // * Open cloud limits modal
        cy.get('#free_plan_data_restrictions_cta').contains('This plan has data restrictions.');
        cy.get('#pricingModal').should('be.visible');
        cy.get('#free_plan_data_restrictions_cta').click();

        cy.get('.CloudUsageModal').should('exist');
        cy.get('.CloudUsageModal').contains('Cloud Free limits');
    });

    it('should not show free disclaimer CTA when on legacy starter product that has no limits', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
            trial_end_at: 100000000, // signifies that this subscription has trialled before
        };
        cy.simulateSubscription(subscription, false);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');
        cy.get('.PricingModal__header').contains('Select a plan');

        // * CTA should not show when there are no limits
        cy.get('#free_plan_data_restrictions_cta').should('not.exist');
    });

    it('should allow downgrades from professional plans', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');
        cy.get('.PricingModal__header').contains('Select a plan');

        // * Check that free card Downgrade button is disabled
        cy.get('#free > .bottom > .bottom_container').should('be.visible');
        cy.get('#free_action').should('not.be.disabled').contains('Downgrade');
    });

    it('should not allow downgrades from enterprise trial', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'true',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');
        cy.get('.PricingModal__header').contains('Select a plan');

        // * Check that free card Downgrade button is disabled
        cy.get('#free > .bottom > .bottom_container').should('be.visible');
        cy.get('#free_action').should('be.disabled').contains('Downgrade');
    });

    it('should not allow downgrades from enterprise plans', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');
        cy.get('#pricingModal').get('.PricingModal__header').contains('Select a plan');

        // * Check that free card Downgrade button is disabled
        cy.get('#pricingModal').should('be.visible');
        cy.get('#free > .bottom > .bottom_container').should('be.visible');
        cy.get('#free_action').should('be.disabled').contains('Downgrade');

        // * Check that professsional card Upgrade button is disabled while on non trial enterprise
        cy.get('#professional > .bottom > .bottom_container').should('be.visible');
        cy.get('#professional_action').should('be.disabled');

        // * Check that Trial button is disabled on enterprise trial
        cy.get('#enterprise > .bottom > .bottom_container').should('be.visible');
        cy.get('#start_cloud_trial_btn').should('be.disabled');
    });

    it('should not allow downgrades from yearly plans', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_4',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');
        cy.get('#pricingModal').get('.PricingModal__header').contains('Select a plan');

        cy.get('#pricingModal').get('#free').get('#free_action').should('not.be.disabled').contains('Contact Support');
    });

    it('should not allow starting a trial from professional plans', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist').should('be.visible');
        cy.get('.PricingModal__header').contains('Select a plan');

        // * Check that Trial button is disabled on enterprise trial
        cy.get('#enterprise > .bottom > .bottom_container').should('be.visible');
        cy.get('#start_cloud_trial_btn').should('be.disabled');
    });

    it('Should display downgrade modal when downgrading from monthly professional to free', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');

        cy.wait(TIMEOUTS.TWO_SEC);

        // * Click the free action (downgrade).
        cy.get('#free').should('exist');
        cy.get('#free_action').should('be.enabled').click();

        // * Check that the downgrade modal has appeard.
        cy.get('div.DowngradeTeamRemovalModal__body').should('exist');
    });

    it('Should display a "Contact Support" CTA for downgrading when the current subscription is yearly and not on starter', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_4',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');

        // * Click the free action (downgrade).
        cy.get('#free').should('exist').contains('Contact Support');
        cy.get('#free_action').should('be.enabled').click();
    });

    it('Should not display a "Contact Support" CTA for downgrading when the current subscription is monthly and not on starter', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');

        // # The free action button should not be disabled and contain the text "Downgrade".
        cy.get('#free').should('exist').contains('Downgrade');
        cy.get('#free_action').should('not.be.disabled');
    });
});
