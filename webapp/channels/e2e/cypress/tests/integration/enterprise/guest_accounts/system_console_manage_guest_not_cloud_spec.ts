// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @guest_account @not_cloud

import * as TIMEOUTS from '../../../fixtures/timeouts';

import {verifyGuest} from './helpers';

describe('Guest Account - Verify Manage Guest Users', () => {
    let guestUser: Cypress.UserProfile;
    let testTeam: Cypress.Team;
    let testChannel: Cypress.Channel;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license for Guest Accounts
        cy.apiRequireLicenseForFeature('GuestAccounts');

        // # Enable GuestAccountSettings
        cy.apiUpdateConfig({
            GuestAccountsSettings: {
                Enable: true,
            },
        });

        // # Create team and guest user account
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            cy.apiCreateGuestUser({}).then(({guest}) => {
                guestUser = guest;

                cy.apiAddUserToTeam(testTeam.id, guestUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, guestUser.id);
                });
            });
        });

        // # Visit System Console Users page
        cy.visit('/admin_console/user_management/users');
    });

    beforeEach(() => {
        // # Reload current page before each test
        cy.reload();

        // # Search for Guest User by username
        cy.get('#searchUsers', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').type(guestUser.username);
    });

    it('MM-18048 Deactivate Guest User and Verify', () => {
        // # Click on the Deactivate option
        cy.wait(TIMEOUTS.HALF_SEC).findByTestId('userListRow').find('.MenuWrapper a').should('be.visible').click();
        cy.wait(TIMEOUTS.HALF_SEC).findByText('Deactivate').click();

        // * Verify the confirmation message displayed
        cy.get('#confirmModal').should('be.visible').within(() => {
            cy.get('#confirmModalLabel').should('be.visible').and('have.text', `Deactivate ${guestUser.username}`);
            cy.get('.modal-body').should('be.visible').and('have.text', `This action deactivates ${guestUser.username}. They will be logged out and not have access to any teams or channels on this system. Are you sure you want to deactivate ${guestUser.username}?`);
        });

        // * Verify the behavior when Cancel button in the confirmation message is clicked
        cy.get('#cancelModalButton').click();
        cy.get('#confirmModal').should('not.exist');
        verifyGuest();

        // * Verify the behavior when Deactivate button in the confirmation message is clicked
        cy.wait(TIMEOUTS.HALF_SEC).findByTestId('userListRow').find('.MenuWrapper a').should('be.visible').click();
        cy.wait(TIMEOUTS.HALF_SEC).findByText('Deactivate').click();
        cy.get('#confirmModalButton').click();
        cy.get('#confirmModal').should('not.exist');
        verifyGuest('Inactive ');

        // # Reload and verify if behavior is same
        cy.reload();
        cy.get('#searchUsers').should('be.visible').type(guestUser.username);
        verifyGuest('Inactive ');
    });

    it('MM-18048 Activate Guest User and Verify', () => {
        // # Click on the Activate option
        cy.wait(TIMEOUTS.HALF_SEC).findByTestId('userListRow').find('.MenuWrapper a').should('be.visible').click();
        cy.wait(TIMEOUTS.HALF_SEC).findByText('Activate').click();

        // * Verify if User's status is activated again
        verifyGuest();

        // # Reload and verify if behavior is same
        cy.reload();
        cy.get('#searchUsers').should('be.visible').type(guestUser.username);
        verifyGuest();
    });
});
