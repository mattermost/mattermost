// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('System Scheme', () => {
    before(() => {
        cy.apiRequireLicense();
    });

    beforeEach(() => {
        cy.apiResetRoles();

        // # Go to `User Management / Permissions` section
        cy.visit('/admin_console/user_management/permissions');
    });

    it('MM-T2862 Default permissions set inherited from system scheme', () => {
        // # Click on `Edit Scheme` under `System Scheme`
        cy.findByTestId('systemScheme-link').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Make a few scheme changes
        cy.findByTestId('all_users-public_channel-create_public_channel-checkbox').should('have.class', 'checked').click();
        cy.findByTestId('all_users-private_channel-create_private_channel-checkbox').should('have.class', 'checked').click();
        cy.findByTestId('all_users-teams-invite_guest-checkbox').should('not.have.class', 'checked').click();

        // # Save scheme
        cy.get('#saveSetting').click().wait(TIMEOUTS.TWO_SEC);

        // # Go back to the `Permission Schemes` page
        cy.visit('/admin_console/user_management/permissions');

        // # Click `New Team Override Scheme`
        cy.findByTestId('team-override-schemes-link').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify scheme settings modified earlier are reflected in this section
        cy.findByTestId('all_users-public_channel-create_public_channel-checkbox').should('not.have.class', 'checked');
        cy.findByTestId('all_users-private_channel-create_private_channel-checkbox').should('not.have.class', 'checked');
        cy.findByTestId('all_users-teams_team_scope-invite_guest-checkbox').should('have.class', 'checked');
    });

    it('MM-T2863 Reset system scheme defaults will revert permissions to defaults', () => {
        // # Click on `Edit Scheme` under `System Scheme`
        cy.findByTestId('systemScheme-link').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Click on `Reset to defaults`
        cy.findByTestId('resetPermissionsToDefault').scrollIntoView().should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Confirm the dialog
        cy.get('#confirmModalButton').click().wait(TIMEOUTS.TWO_SEC);

        // # Make a few changes to the scheme
        cy.findByTestId('guests-guest_create_private_channel-checkbox').should('not.have.class', 'checked').click();
        cy.findByTestId('all_users-public_channel-create_public_channel-checkbox').should('have.class', 'checked').click();
        cy.findByTestId('all_users-private_channel-create_private_channel-checkbox').should('have.class', 'checked').click();

        // # Save changes
        cy.get('#saveSetting').click().wait(TIMEOUTS.HALF_SEC);

        // # Go back to the `Permission Schemes` page
        cy.visit('/admin_console/user_management/permissions');

        // # Click on `Edit Scheme` under `System Scheme`
        cy.findByTestId('systemScheme-link').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify previous scheme changes have been saved
        cy.findByTestId('guests-guest_create_private_channel-checkbox').should('have.class', 'checked');
        cy.findByTestId('all_users-public_channel-create_public_channel-checkbox').should('not.have.class', 'checked');
        cy.findByTestId('all_users-private_channel-create_private_channel-checkbox').should('not.have.class', 'checked');

        // # Click on `Reset to defaults`
        cy.findByTestId('resetPermissionsToDefault').scrollIntoView().should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Confirm the dialog
        cy.get('#confirmModalButton').scrollIntoView().click().wait(TIMEOUTS.HALF_SEC);

        // # Save changes
        cy.get('#saveSetting').click().wait(TIMEOUTS.TWO_SEC);

        // # Reload the page
        cy.reload();

        // * Verify scheme settings have been reset to defaults
        cy.findByTestId('guests-guest_create_private_channel-checkbox').should('not.have.class', 'checked');
        cy.findByTestId('all_users-public_channel-create_public_channel-checkbox').should('have.class', 'checked');
        cy.findByTestId('all_users-private_channel-create_private_channel-checkbox').should('have.class', 'checked');
    });
});
