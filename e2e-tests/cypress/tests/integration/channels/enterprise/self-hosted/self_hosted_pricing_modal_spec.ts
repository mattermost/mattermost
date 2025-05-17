// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @not_cloud

describe('Self hosted View plans button', () => {
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

    it('View plans button should open pricing page in new tab when clicked by admin users when no trial has ever been added on free plan', () => {
        // *Ensure the server has had no trial license before
        withTrialBefore('false');

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

    it('View plans button should open pricing page in new tab when the server has requested a trial before on free plan', () => {
        // *Ensure the server has had no trial license before
        withTrialBefore('true');

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
        cy.get('.alert-option').should('not.exist');
    });

    it('View plans button should open pricing page when the server is on a trial', () => {
        // * Ensure the server has trial license
        withTrialBefore('false');
        withTrialLicense('true');

        cy.apiLogout();
        cy.apiAdminLogin();

        // * Verify the license is a trial
        cy.visit('admin_console/about/license');
        cy.get('div.Badge').should('exist').should('contain', 'Trial');
        cy.findByTitle('Back Icon').should('be.visible').click();
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

    it('View plans button should open pricing page in new tab even when hosted signup is not available', () => {
        cy.apiAdminLogin();

        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {
            statusCode: 501,
            body: {
                message: 'An unknown error occurred. Please try again or contact support.',
            },
        }).as('airGappedCheck');

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
});
