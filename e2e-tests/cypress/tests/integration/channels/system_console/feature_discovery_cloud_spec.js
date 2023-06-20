// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @cloud_only

const professionalPaidFeatures = [
    {sidebarName: 'Announcement Banner', featureDiscoveryTitle: 'custom announcement banners'},
    {sidebarName: 'AD/LDAP', featureDiscoveryTitle: 'LDAP'},
    {sidebarName: 'SAML 2.0', featureDiscoveryTitle: 'SAML'},
    {sidebarName: 'OpenID Connect', featureDiscoveryTitle: 'OpenID Connect'},
    {sidebarName: 'Guest Access', featureDiscoveryTitle: 'guest accounts'},
];

const enterprisePaidFeatures = [
    {sidebarName: 'Groups', featureDiscoveryTitle: 'Active Directory/LDAP groups'},
    {sidebarName: 'System Roles', featureDiscoveryTitle: 'controlled access to the System Console'},
    {sidebarName: 'Data Retention Policy', featureDiscoveryTitle: 'Create data retention schedules with Mattermost Enterprise'},
    {sidebarName: 'Compliance Export', featureDiscoveryTitle: 'Run compliance exports with Mattermost Enterprise'},
    {sidebarName: 'Custom Terms of Service', featureDiscoveryTitle: 'Create custom terms of service with Mattermost Enterprise'},
];

function simulateSubscription(subscription) {
    cy.intercept('GET', '**/api/v4/cloud/subscription', {
        statusCode: 200,
        body: subscription,
    });
}

function withTrialBefore(trialed) {
    cy.intercept('GET', '**/api/v4/trial-license/prev', {
        statusCode: 200,
        body: {
            IsLicensed: trialed,
            IsTrial: trialed,
        },
    });
}

describe('Feature discovery cloud', () => {
    beforeEach(() => {
        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');

        // # Visit admin console
        cy.visit('/admin_console');
    });

    const testForTrialButton = () => {
        cy.get('#start_cloud_trial_btn').should('exist');
        cy.get('#start_cloud_trial_btn').contains('Start trial');
    };

    const testForUpgradeToProfessionalOption = () => {
        cy.get("button[data-testid='featureDiscovery_primaryCallToAction']").should('contain', 'Upgrade now');
        cy.get("button[data-testid='featureDiscovery_primaryCallToAction']").click();

        cy.get('.PurchaseModal').should('exist');

        // *Close PurchaseModal
        cy.get('.close-x').click();
    };

    it('MM-T5120 Cloud | Ensure feature discovery shows option to start trial when no trial has ever been done before', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };
        simulateSubscription(subscription);
        withTrialBefore('false');
        [...professionalPaidFeatures, ...enterprisePaidFeatures].forEach(({sidebarName, featureDiscoveryTitle}) => {
            cy.get('li').contains(sidebarName).click();
            cy.get("div[data-testid='featureDiscovery_title']").should('contain', featureDiscoveryTitle);
            testForTrialButton();
        });
    });

    it('MM-T5121 Cloud | Ensure feature discovery for professional features shows option to upgrade to professional', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
            trial_end_at: 1,
        };
        simulateSubscription(subscription);
        withTrialBefore('false');
        professionalPaidFeatures.forEach(({sidebarName, featureDiscoveryTitle}) => {
            cy.get('li').contains(sidebarName).click();
            cy.get("div[data-testid='featureDiscovery_title']").should('contain', featureDiscoveryTitle);
            testForUpgradeToProfessionalOption();
        });
    });

    it('MM-T5122 Cloud | Ensure feature discovery for enterprise features shows option to contact sales', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
            trial_end_at: 1,
        };
        simulateSubscription(subscription);
        withTrialBefore('false');
        enterprisePaidFeatures.forEach(({sidebarName, featureDiscoveryTitle}) => {
            cy.get('li').contains(sidebarName).click();
            cy.get("div[data-testid='featureDiscovery_title']").should('contain', featureDiscoveryTitle);
            cy.get("button[data-testid='featureDiscovery_primaryCallToAction']").should('contain', 'Contact sales');
        });
    });
});
