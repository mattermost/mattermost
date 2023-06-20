// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @integrations

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Integrations', () => {
    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(() => {
            cy.visit('/');
            cy.postMessage('hello');
        });
    });

    // This test was moved here since Cypress is behaving differently as compared to browser
    // and kept redirecting into the landing page even if the corresponding localstorage is already set.
    it('MM-T686 /logout', () => {
        // # Type "/logout"
        cy.uiGetPostTextBox().should('be.visible').clear().type('/logout {enter}').wait(TIMEOUTS.HALF_SEC);

        // * Ensure that the user was redirected to the login page
        cy.url().should('include', '/login');
    });
});
