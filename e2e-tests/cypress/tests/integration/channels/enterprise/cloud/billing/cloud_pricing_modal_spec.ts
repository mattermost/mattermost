// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @cloud_only @cloud_trial

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

describe('View plans button', () => {
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

    it('should check for ability for non-admin users to view plans on free plans', () => {
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
        cy.get('#view_plans_cta').should('be.visible');
        
        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get('#view_plans_cta').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank');
    });

    it('should check for ability for non-admin users to view plans on professional monthly plans', () => {
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
        cy.get('#view_plans_cta').should('be.visible');
        
        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get('#view_plans_cta').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank');
    });

    it('should check for ability for non-admin users to view plans on enterprise', () => {
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
        cy.get('#view_plans_cta').should('be.visible');
        
        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get('#view_plans_cta').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank');
        
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

    it('should open pricing page when View plans button clicked while in free sku', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // * Check that the view plans button exists
        cy.get('#UpgradeButton').should('exist');

        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get('#UpgradeButton').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank');
        
    });

    it('should open pricing page when View plans button clicked while in enterprise trial sku', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'true',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // * Check that the view plans button exists
        cy.get('#UpgradeButton').should('exist');

        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get('#UpgradeButton').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank');
        
    });

    it('should open pricing page when View plans button clicked while in post trial free sku', () => {
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

        // * Check that the view plans button exists
        cy.get('#UpgradeButton').should('exist');

        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get('#UpgradeButton').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank');
        
    });

    it('should open pricing page when View plans button clicked while in monthly professional', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2', //professional monthly
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit('/admin_console/billing/subscription');

        // * Check that the view plans button exists in the admin console
        cy.get('[data-testid="billing-view-plans-button"]').should('exist');

        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get('[data-testid="billing-view-plans-button"]').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank');
        
    });

    it('should show View plans button when in yearly professional', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_4', //professional yearly
            is_free_trial: 'false',
        };
        simulateSubscription(subscription);
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit('/admin_console/billing/subscription');

        // * Check that the view plans button exists in the admin console
        cy.get('[data-testid="billing-view-plans-button"]').should('exist');

        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get('[data-testid="billing-view-plans-button"]').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank');
        
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
