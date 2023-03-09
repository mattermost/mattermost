// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @system_console

import * as TIMEOUTS from '../../fixtures/timeouts';
import {getAdminAccount} from '../../support/env';

describe('System Console > User Management > Users', () => {
    const admin = getAdminAccount();

    it('MM-T940 Users - Revoke all sessions', () => {
        // # Login as System Admin
        cy.apiAdminLogin();

        cy.visit('/admin_console/user_management/users');

        // * Verify the presence of Revoke All Sessions button
        cy.get('#revoke-all-users').should('be.visible').and('not.have.class', 'btn-danger').click();

        // * Verify the confirmation message when users clicks on the Revoke All Sessions button
        cy.get('#confirmModalLabel').should('be.visible').and('have.text', 'Revoke all sessions in the system');
        cy.get('.modal-body').should('be.visible').and('have.text', 'This action revokes all sessions in the system. All users will be logged out from all devices. Are you sure you want to revoke all sessions?');
        cy.get('#confirmModalButton').should('be.visible').and('have.class', 'btn-danger');

        // # Click on Cancel button in the confirmation message
        cy.get('#cancelModalButton').click();

        // * Verify if Confirmation message is closed
        cy.get('#confirmModal').should('not.exist');

        // * Verify if the Admin's session is still active and user is still in the same page
        cy.url().should('contain', '/admin_console/user_management/users');

        // * Verify if the Admin's Session is still active and click on it and then confirm
        cy.get('#revoke-all-users').should('be.visible').click();
        cy.get('#confirmModalButton').click();

        // * Verify if Admin User's session is expired and is redirected to login page
        cy.url({timeout: TIMEOUTS.HALF_MIN}).should('include', '/login');
        cy.get('.login-body-card', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible');
    });

    it('Verify for Regular Member', () => {
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
                cy.get('.login-body-card', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible');
            });
        });
    });
});
