// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console @enterprise @not_cloud

import {FixedPublicLinks} from '../../../../utils';

describe('Edition and License', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license
        cy.apiRequireLicense();

        // # Go to admin console
        cy.visit('/admin_console');
    });

    it('MM-T899 - Edition and License: Verify Privacy Policy link points to correct URL', () => {
        // * Find text and verify its corresponding public link
        [
            {text: 'Privacy Policy', link: FixedPublicLinks.PrivacyPolicy},
            {text: 'Enterprise Edition Terms of Use', link: FixedPublicLinks.TermsOfService},
        ].forEach(({text, link}) => {
            cy.findByText(text).
                scrollIntoView().
                should('be.visible').
                and('have.attr', 'href').
                and('include', link);
        });
    });
});
