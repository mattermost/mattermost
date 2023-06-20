// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @system_console

import {
    FixedPublicLinks,
} from '../../../../utils';

import * as TIMEOUTS from '../../../../fixtures/timeouts';

import {backToTeam, saveSetting} from './helper';

describe('SupportSettings', () => {
    const tosLink = 'https://github.com/mattermost/platform/blob/master/README.md';
    const privacyLink = 'https://github.com/mattermost/platform/blob/master/README.md';

    let siteName;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiGetConfig().then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiUpdateConfig();

        // # Visit customization system console page
        cy.visit('/admin_console/site_config/customization');
    });

    it('MM-T1032 - Customization: Custom Terms and Privacy links in the About modal', () => {
        // # Edit links in the TOS and Privacy fields
        cy.findByTestId('SupportSettings.TermsOfServiceLinkinput').clear().type(tosLink);
        cy.findByTestId('SupportSettings.PrivacyPolicyLinkinput').clear().type(privacyLink);

        // # Save setting then back to team view
        saveSetting();
        backToTeam();

        // # Open about modal
        cy.uiOpenProductMenu(`About ${siteName}`);

        // * Verify that links do not change and they open to default pages
        cy.get('#tosLink').should('contain', 'Terms of Use').and('have.attr', 'href').and('equal', FixedPublicLinks.TermsOfService);
        cy.get('#privacyLink').should('contain', 'Privacy Policy').and('have.attr', 'href').and('equal', FixedPublicLinks.PrivacyPolicy);
    });

    it('MM-T1034 - Customization: Blank TOS link field (About modal)', () => {
        // # Empty the "terms of services" field
        cy.findByTestId('SupportSettings.TermsOfServiceLinkinput').type('any').clear();

        // # Save setting then back to team view
        saveSetting();
        backToTeam();

        // # Open about modal
        cy.uiOpenProductMenu(`About ${siteName}`);

        // * Verify that tos link is set to default
        cy.get('#tosLink').should('contain', 'Terms of Use').and('have.attr', 'href').and('equal', FixedPublicLinks.TermsOfService);
    });

    it('MM-T1035 - Customization Blank Privacy hides the link', () => {
        cy.findByTestId('SupportSettings.PrivacyPolicyLinkinput').clear();

        // # Save setting then back to team view
        saveSetting();
        backToTeam();

        // # Open about modal
        cy.uiOpenProductMenu(`About ${siteName}`);

        // * Verify that tos link is there
        cy.get('#tosLink').should('be.visible').and('contain', 'Terms of Use');

        // * Verify that privacy link is there
        cy.get('#privacyLink').should('contain', 'Privacy Policy').and('have.attr', 'href').and('equal', FixedPublicLinks.PrivacyPolicy);

        // # Logout
        cy.apiLogout();

        // * Verify that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        // * Verify no privacy link
        cy.findByText('Privacy Policy').should('not.exist');

        // # Visit signup page
        cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').click();

        // * Verify no privacy link
        cy.get('.hfroute-footer').scrollIntoView().should('be.visible').within(() => {
            cy.findByText('Privacy Policy').should('not.exist');
        });
    });
});
