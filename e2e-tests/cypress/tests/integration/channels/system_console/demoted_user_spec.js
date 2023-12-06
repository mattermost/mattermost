// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console @smoke

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getAdminAccount} from '../../../support/env';

describe('System Console', () => {
    const sysadmin = getAdminAccount();
    let testUser;

    before(() => {
        // # Create new team and login
        cy.apiInitSetup({loginAfter: true}).then(({user}) => {
            testUser = user;
        });
    });

    it('MM-T922 Demoted user cannot continue to view System Console', () => {
        const baseUrl = Cypress.config('baseUrl');

        // # Set user to be a sysadmin, so it can access the system console
        cy.externalRequest({user: sysadmin, method: 'put', baseUrl, path: `users/${testUser.id}/roles`, data: {roles: 'system_user system_admin'}});

        // # Visit a page on the system console
        cy.visit('/admin_console/reporting/system_analytics');
        cy.get('#adminConsoleWrapper').should('be.visible');
        cy.url().should('include', '/admin_console/reporting/system_analytics');

        // # Change the role of the user back to user
        cy.externalRequest({user: sysadmin, method: 'put', baseUrl, path: `users/${testUser.id}/roles`, data: {roles: 'system_user'}});

        // # User should get redirected to town square
        cy.get('#adminConsoleWrapper').should('not.exist');
        cy.get('#postListContent', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible');
        cy.url().should('include', 'town-square');
    });
});
