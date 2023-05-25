// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @system_console @not_cloud

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

function withTrialBefore(trialed) {
    cy.intercept('GET', '**/api/v4/trial-license/prev', {
        statusCode: 200,
        body: {
            IsLicensed: trialed,
            IsTrial: trialed,
        },
    });
}

describe('Feature discovery self hosted', () => {
    beforeEach(() => {
        cy.shouldRunOnTeamEdition();
        cy.shouldNotRunOnCloudEdition();

        // # Visit admin console
        cy.visit('/admin_console');
    });

    it('MM-T5123 Self-Hosted | Ensure feature discovery shows option to start trial when no trial has ever been done before', () => {
        withTrialBefore('false');
        [...professionalPaidFeatures, ...enterprisePaidFeatures].forEach(({sidebarName, featureDiscoveryTitle}) => {
            cy.get('li').contains(sidebarName).click();
            cy.get("div[data-testid='featureDiscovery_title']").should('contain', featureDiscoveryTitle);
            cy.get('#start_trial_btn').should('exist');
            cy.get('#start_trial_btn').contains('Start trial');
        });
    });

    it('MM-T5124 Self-Hosted | Ensure feature discovery for professional features shows option to purchase when a trial has been done before', () => {
        withTrialBefore('true');
        professionalPaidFeatures.forEach(({sidebarName, featureDiscoveryTitle}) => {
            cy.get('li').contains(sidebarName).click();
            cy.get("div[data-testid='featureDiscovery_title']").should('contain', featureDiscoveryTitle);
            cy.get('#post_trial_purchase_license').should('contain', 'Purchase a license');
            cy.get('#post_trial_purchase_license').should('be.enabled');
        });
    });

    it('MM-T5125 Self-Hosted | Ensure feature discovery for enterprise features shows option to contact sales when a trial has been done before', () => {
        withTrialBefore('true');
        enterprisePaidFeatures.forEach(({sidebarName, featureDiscoveryTitle}) => {
            cy.get('li').contains(sidebarName).click();
            cy.get("div[data-testid='featureDiscovery_title']").should('contain', featureDiscoveryTitle);
            cy.get("button[data-testid='featureDiscovery_primaryCallToAction']").should('contain', 'Contact sales');
            cy.get("button[data-testid='featureDiscovery_primaryCallToAction']").should('be.enabled');
        });
    });
});
