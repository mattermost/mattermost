// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @system_console @authentication

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Authentication', () => {
    before(() => {
        // # Enable open server
        cy.apiUpdateConfig({
            TeamSettings: {
                EnableOpenServer: false,
            },
        });

        // # Logout and visit default page
        cy.apiLogout();
        cy.visit('/');
    });

    it('MM-T1760 - Enable Open Server false: Create account link is hidden', () => {
        // * Assert that create account button is not visible
        cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.TEN_SEC}).should('not.exist');
    });
});
