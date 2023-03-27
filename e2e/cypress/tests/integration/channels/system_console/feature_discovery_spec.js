// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @te_only @system_console

describe('Feature discovery', () => {
    before(() => {
        cy.shouldRunOnTeamEdition();

        // # Visit admin console
        cy.visit('/admin_console');
    });

    const testCallsToAction = () => {
        cy.get("a[data-testid$='CallToAction']").each(($el) => {
            cy.wrap($el).should('have.attr', 'href').and('not.eq', '');
            cy.wrap($el).should('have.attr', 'target', '_blank');
        });
    };

    it('MM-T4035 - Make Sure All Feature Discoveries Exist', () => {
        [
            {sidebarName: 'AD/LDAP', featureDiscoveryTitle: 'LDAP'},
            {sidebarName: 'SAML 2.0', featureDiscoveryTitle: 'SAML'},
            {sidebarName: 'OpenID Connect', featureDiscoveryTitle: 'OpenID Connect'},
            {sidebarName: 'Groups', featureDiscoveryTitle: 'Active Directory/LDAP groups'},
            {sidebarName: 'Compliance Export', featureDiscoveryTitle: 'compliance exports'},
            {sidebarName: 'System Roles', featureDiscoveryTitle: 'controlled access to the System Console'},
            {sidebarName: 'Permissions', featureDiscoveryTitle: 'role-based permissions'},
            {sidebarName: 'Channels', featureDiscoveryTitle: 'read-only channels'},
            {sidebarName: 'Custom Terms of Service', featureDiscoveryTitle: 'custom terms of service'},
            {sidebarName: 'Announcement Banner', featureDiscoveryTitle: 'custom announcement banners'},
            {sidebarName: 'Guest Access', featureDiscoveryTitle: 'guest accounts'},
        ].forEach(({sidebarName, featureDiscoveryTitle}) => {
            cy.get('li').contains(sidebarName).click();
            cy.get("div[data-testid='featureDiscovery_title']").should('contain', featureDiscoveryTitle);
            testCallsToAction();
        });
    });
});
