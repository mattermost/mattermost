// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getAdminAccount} from '../../../support/env';

describe('System Console > User Management > Users', () => {
    const admin = getAdminAccount();

    it('MM-T940 Users - Revoke all sessions from a button in admin console', () => {
        // # Login as System Admin
        cy.apiAdminLogin();

        cy.visit('/admin_console/user_management/users');

        // * Verify the presence of Revoke All Sessions button and click on it
        cy.findByText('Revoke All Sessions').should('be.visible').click();

        // * Verify the confirmation message when users clicks on the Revoke All Sessions button
        cy.get('#confirmModal').should('be.visible').within(() => {
            // * Verify the presence of confirmation messages and buttons
            cy.findByText('Revoke all sessions in the system').should('be.visible');
            cy.findByText('This action revokes all sessions in the system. All users will be logged out from all devices, including your session. Are you sure you want to revoke all sessions?').should('be.visible');
            cy.findByText('Cancel').should('be.visible');
            cy.findByText('Revoke All Sessions').should('be.visible');

            // # Click on Cancel button in the confirmation message
            cy.findByText('Cancel').click();
        });

        // * Verify if Confirmation message is closed
        cy.get('#confirmModal').should('not.exist');

        // * Since we have cancelled the confirmation message, verify if the Admin's session is still active and user is still in the same page
        cy.url().should('contain', '/admin_console/user_management/users');

        // # Open revoke all sessions modal again
        cy.findByText('Revoke All Sessions').should('be.visible').click();

        cy.get('#confirmModal').should('be.visible').within(() => {
            // # Click on Revoke All Sessions button in the confirmation message
            cy.findByText('Revoke All Sessions').click();
        });

        // * Verify if Admin User's session is expired and is redirected to login page
        cy.url({timeout: TIMEOUTS.HALF_MIN}).should('include', '/login');
        cy.findByText('Log in to your account').should('be.visible');
    });

    it('MM-T940-1 Users - Revoke all sessions with an API call', () => {
        // # Login as System Admin
        cy.apiAdminLogin();

        // # Create new setup, login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Issue a Request to Revoke All Sessions as SysAdmin
            const baseUrl = Cypress.config('baseUrl');
            cy.externalRequest({user: admin, method: 'post', baseUrl, path: 'users/sessions/revoke/all'}).then(() => {
                // # Initiate browser activity like visit to town-square
                cy.visit(`/${team.name}/channels/town-square`);

                // * Verify if the regular member is logged out and redirected to login page
                cy.url({timeout: TIMEOUTS.HALF_MIN}).should('include', '/login');
                cy.findByText('Log in to your account').should('be.visible');
            });
        });
    });
});
