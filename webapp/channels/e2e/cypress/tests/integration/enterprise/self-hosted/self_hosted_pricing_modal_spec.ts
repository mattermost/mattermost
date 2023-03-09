// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @enterprise @not_cloud

function withTrialBefore(trialed: string) {
    cy.intercept('GET', '**/api/v4/trial-license/prev', {
        statusCode: 200,
        body: {
            IsLicensed: trialed,
            IsTrial: trialed,
        },
    });
}

function withTrialLicense(trial: string) {
    cy.intercept('GET', '**/api/v4/license/client?format=old', {
        statusCode: 200,
        body: {
            IsLicensed: 'true',
            IsTrial: trial,
        },
    });
}

describe('Self hosted Pricing modal', () => {
    let urlL: string | undefined;
    let createdUser: Cypress.UserProfile | undefined;

    before(() => {
        cy.apiInitSetup().then(({user, offTopicUrl: url}) => {
            urlL = url;
            createdUser = user;
            cy.apiAdminLogin();
            cy.apiDeleteLicense();
            cy.visit(url);
        });
    });

    it('should show Upgrade button in global header for admin users on starter plan', () => {
        // * Check that Upgrade button does not show
        cy.get('#UpgradeButton').should('exist').contains('View plans');

        // * Check for Upgrade button tooltip
        cy.get('#UpgradeButton').trigger('mouseover').then(() => {
            cy.get('#upgrade_button_tooltip').should('be.visible').contains('Only visible to system admins');
        });
    });

    it('should not show Upgrade button in global header for non admin users', () => {
        cy.apiLogout();
        cy.apiLogin(createdUser);
        cy.visit(urlL);

        // * Check that Upgrade button does not show
        cy.get('#UpgradeButton').should('not.exist');
    });

    it('should not show Upgrade button for admin users on non trial licensed server', () => {
        // * Ensure the server has trial license
        withTrialBefore('false');
        withTrialLicense('false');
        cy.apiLogout();
        cy.apiAdminLogin();

        // * Verify the license is not trial
        cy.visit('admin_console/about/license');
        cy.get('div.Badge').should('not.exist');
        cy.findByTitle('Back Icon').should('be.visible').click();

        // * Open pricing modal
        cy.get('#UpgradeButton').should('not.exist');
    });

    it('Upgrade button should open pricing modal admin users when no trial has ever been added on free plan', () => {
        // *Ensure the server has had no trial license before
        withTrialBefore('false');

        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // * Open pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // * Check that free card Downgrade button is disabled
        cy.get('#pricingModal').should('be.visible');
        cy.get('#free').should('be.visible');
        cy.get('#free_action').should('be.disabled').contains('Downgrade');

        // * Check that professional upgrade button is available
        cy.get('#pricingModal').should('be.visible');
        cy.get('#professional').should('be.visible');
        cy.get('#professional_action').should('not.be.disabled').contains('Upgrade');

        // * Check that enteprise trial button is available
        cy.get('#pricingModal').should('be.visible');
        cy.get('#enterprise').should('be.visible');
        cy.get('#start_trial_btn').should('not.be.disabled').contains('Try free for 30 days');
    });

    it('Upgrade button should open pricing modal admin users when the server has requested a trial before on free plan', () => {
        // *Ensure the server has had no trial license before
        withTrialBefore('true');

        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(urlL);

        // * Open pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // *Check that option to get cloud exists
        cy.get('.alert-option').should('be.visible');
        cy.get('span').contains('Looking for a cloud option?');

        // * Check that free card Downgrade button is disabled
        cy.get('#pricingModal').should('be.visible');
        cy.get('#free').should('be.visible');
        cy.get('#free_action').should('be.disabled').contains('Downgrade');

        // * Check that professional upgrade button is available
        cy.get('#pricingModal').should('be.visible');
        cy.get('#professional').should('be.visible');
        cy.get('#professional_action').should('not.be.disabled').contains('Upgrade');

        // * Check that contact sales button is now showing and not trial button
        cy.get('#pricingModal').should('be.visible');
        cy.get('#enterprise').should('be.visible');
        cy.get('#enterprise_action').should('not.be.disabled').contains('Contact Sales');
    });

    it('Upgrade button should open pricing modal admin users when the server is on a trial', () => {
        // * Ensure the server has trial license
        withTrialBefore('false');
        withTrialLicense('true');

        cy.apiLogout();
        cy.apiAdminLogin();

        // * Verify the license is not trial
        cy.visit('admin_console/about/license');
        cy.get('div.Badge').should('exist').should('contain', 'Trial');
        cy.findByTitle('Back Icon').should('be.visible').click();
        cy.visit(urlL);

        // * Open pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        // *Check that free card Downgrade button is disabled
        cy.get('#pricingModal').should('be.visible');
        cy.get('#free').should('be.visible');
        cy.get('#free_action').should('be.disabled').contains('Downgrade');

        // * Check that professional upgrade button is available
        cy.get('#pricingModal').should('be.visible');
        cy.get('#professional').should('be.visible');
        cy.get('#professional_action').should('not.be.disabled').contains('Upgrade');

        // * Check that contact sales button is now showing and not trial button
        cy.get('#pricingModal').should('be.visible');
        cy.get('#enterprise').should('be.visible');
        cy.get('#start_trial_btn').should('not.be.disabled');
    });

    it('Upgrade button should open air gapped modal when hosted signup is not available', () => {
        cy.apiAdminLogin();

        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {
            statusCode: 501,
            body: {
                message: 'An unknown error occurred. Please try again or contact support.',
            },
        }).as('airGappedCheck');

        // * Open pricing modal
        cy.get('#UpgradeButton').should('exist').click();

        cy.wait('@airGappedCheck');

        // * Click the upgrade button to open the modal
        cy.get('#professional_action').should('exist').click();

        cy.get('.air-gapped-purchase-modal').should('exist');

        cy.findByText('https://mattermost.com/pricing/#self-hosted').last().should('exist');
    });
});
