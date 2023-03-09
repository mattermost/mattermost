// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @cloud_only @cloud_trial
describe('Feedback modal', () => {
    beforeEach(() => {
        cy.apiLogout();
        cy.apiAdminLogin();
    });

    it('Should display feedback modal when downgrading to cloud free', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);

        // # Intercepts the teams request to avoid team selection modal.
        cy.intercept('**/api/v4/usage/teams', {statusCode: 200, body: {active: 1, cloud_archived: 0}}).as('teams');

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        cy.wait('@teams');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');

        // * Free action (downgrade) should exist.
        // # Click it.
        cy.get('#free_action').contains('Downgrade').should('exist').should('be.enabled').click();

        // * Downgrade feedback should exist.
        cy.findByText('Please share your reason for downgrading').should('exist');

        // * The submit (Downgrade) button should be disabled.
        cy.get('.GenericModal__button.confirm').contains('Downgrade').should('exist').should('be.disabled');

        // # Click the free action (downgrade).
        cy.findByTestId('Exploring other solutions').click();

        // # Click the submit for the downgrade feedback.
        cy.get('.GenericModal__button.confirm').contains('Downgrade').should('exist').should('be.enabled').click();

        // * The downgrade modal should exist.
        cy.findByText('Downgrading your workspace').should('exist');
    });

    it('Downgrade Feedback modal submit button should be disabled if no option is selected', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);

        // # Intercepts the teams request to avoid team selection modal.
        cy.intercept('**/api/v4/usage/teams', {statusCode: 200, body: {active: 1, cloud_archived: 0}}).as('teams');

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        cy.wait('@teams');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');

        // * Free action (downgrade) should exist.
        // # Click it.
        cy.get('#free_action').contains('Downgrade').should('exist').should('be.enabled').click();

        // * Downgrade feedback should exist.
        cy.findByText('Please share your reason for downgrading').should('exist');

        // * The submit (Downgrade) button should be disabled.
        cy.get('.GenericModal__button.confirm').contains('Downgrade').should('exist').should('be.disabled');
    });

    it('Downgrade Feedback modal shows error state when "other" option is selected but not comments have been provided', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);

        // # Intercepts the teams request to avoid team selection modal.
        cy.intercept('**/api/v4/usage/teams', {statusCode: 200, body: {active: 1, cloud_archived: 0}}).as('teams');

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        cy.wait('@teams');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');

        // * Free action (downgrade) should exist.
        // # Click it.
        cy.get('#free_action').contains('Downgrade').should('exist').should('be.enabled').click();

        // * Downgrade feedback should exist.
        cy.findByText('Please share your reason for downgrading').should('exist');

        // * The submit (Downgrade) button should be disabled.
        cy.get('.GenericModal__button.confirm').contains('Downgrade').should('exist').should('be.disabled');

        // # Click the other option, requiring extra comments.
        cy.get('input[value="Other"]').click();

        // # Fill in the comments.
        cy.findByTestId('FeedbackModal__TextInput').type('Do not need it anymore.');

        // * The submit (Downgrade) button should be enabled.
        // # Click it.
        cy.get('.GenericModal__button.confirm').contains('Downgrade').should('exist').should('be.enabled').click();
    });

    it('Downgrade Feedback modal appears and downgrades after team selection modal is submitted', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);

        // # Intercepts the teams request to avoid team selection modal.
        cy.intercept('**/api/v4/usage/teams', {statusCode: 200, body: {active: 2, cloud_archived: 0}}).as('teams');

        // # Open the pricing modal
        cy.visit('/admin_console/billing/subscription?action=show_pricing_modal');

        cy.wait('@teams');

        // * Pricing modal should be open
        cy.get('#pricingModal').should('exist');

        // * Free action (downgrade) should exist.
        // # Click it.
        cy.get('#free_action').contains('Downgrade').should('exist').should('be.enabled').click();

        // * Team selection modal should exist.
        cy.findByText('Confirm Plan Downgrade').should('exist');

        // The test-id is the team id, can't find it in any network requests for interception.
        // # Click the first team.
        cy.get('input[name="deleteTeamRadioGroup"]').first().click();

        // Can't seem to get the button via findByText, use css selector instead.
        cy.get('.DowngradeTeamRemovalModal__buttons > .btn-primary').should('exist').should('be.enabled').click();

        // * Downgrade feedback should exist.
        cy.findByText('Please share your reason for downgrading').should('exist');

        // * The submit (Downgrade) button should be disabled.
        cy.get('.GenericModal__button.confirm').contains('Downgrade').should('exist').should('be.disabled');

        // # Click the other option, requiring extra comments.
        cy.get('input[value="Other"]').click();

        // # Fill in the comments.
        cy.findByTestId('FeedbackModal__TextInput').type('Do not need it anymore.');

        // * The submit (Downgrade) button should be enabled.
        // # Click it.
        cy.get('.GenericModal__button.confirm').contains('Downgrade').should('exist').should('be.enabled').click();
    });
});
