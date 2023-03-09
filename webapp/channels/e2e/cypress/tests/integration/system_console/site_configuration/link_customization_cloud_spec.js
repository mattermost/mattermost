// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @system_console @enterprise @cloud_only

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {SupportSettings} from '../../../utils/constants';

describe('SupportSettings', () => {
    before(() => {
        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');

        // # As admin, visit default team/channel
        cy.visit('/');
    });

    it('MM-T1031 - Customization Change all links', () => {
        // # Open about modal
        cy.uiOpenHelpMenu().within(() => {
            // * Verify links changed
            [
                {text: 'Ask the community', link: SupportSettings.ASK_COMMUNITY_LINK},
                {text: 'Help resources', link: SupportSettings.HELP_LINK},
                {text: 'Report a problem', link: SupportSettings.REPORT_A_PROBLEM_LINK},
                {text: 'Keyboard shortcuts'},
            ].forEach(({text, link}) => {
                if (link) {
                    cy.findByText(text).
                        parent().
                        should('have.attr', 'href', link);
                } else {
                    cy.findByText(text);
                }
            });
        });

        // # Logout
        cy.uiLogout();

        // * Verify that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        const guides = [
            {text: 'About', link: SupportSettings.ABOUT_LINK},
            {text: 'Privacy Policy', link: SupportSettings.PRIVACY_POLICY_LINK},
            {text: 'Terms', link: SupportSettings.TERMS_OF_SERVICE_LINK},
            {text: 'Help', link: SupportSettings.HELP_LINK},
        ];

        // * Verify that links are correct at login page
        guides.forEach((guide) => {
            cy.findByText(guide.text).
                should('have.attr', 'href', guide.link);
        });

        // # Visit signup page
        cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').click();
        cy.url().should('include', '/signup_user_complete');

        // * Verify that links are correct at signup page
        guides.forEach((guide) => {
            cy.findByText(guide.text).
                should('have.attr', 'href', guide.link);
        });
    });
});
