// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @guest_account

/**
 * Note: This test requires Enterprise license to be uploaded
 */

import {getRandomId} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

import {
    changeGuestFeatureSettings,
    invitePeople,
    verifyInvitationError,
    verifyInvitationSuccess,
} from './helpers';

describe('Guest Account - Guest User Invitation Flow', () => {
    let testTeam: Cypress.Team;

    before(() => {
        // * Check if server has license for Guest Accounts
        cy.apiRequireLicenseForFeature('GuestAccounts');
    });

    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        // # Reset Guest Feature settings
        changeGuestFeatureSettings();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            // # Go to town square
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T1336 Invite Guests - Existing Team Member', () => {
        cy.apiCreateUser().then(({user: newUser}) => {
            cy.apiAddUserToTeam(testTeam.id, newUser.id).then(() => {
                // # Search and add an existing member by username who is part of the team
                invitePeople(newUser.username, 1, newUser.username);

                // * Verify the content and message in next screen
                verifyInvitationError(newUser.username, testTeam, 'This person is already a member.');
            });
        });
    });

    it('MM-T1337 Invite Guests - Existing Team Guest', () => {
        cy.apiCreateGuestUser({}).then(({guest}) => {
            cy.apiAddUserToTeam(testTeam.id, guest.id).then(() => {
                // # Search and add an existing guest by first name, who is part of the team but not channel
                invitePeople(guest.first_name, 1, guest.username, 'Off-Topic');

                // * Verify the content and message in next screen
                verifyInvitationSuccess(guest.username, testTeam, 'This guest has been added to the team and channel.');

                // # Search and add an existing guest by last name, who is part of the team and channel
                invitePeople(guest.last_name, 1, guest.username, 'Off-Topic');

                // * Verify the content and message in next screen
                verifyInvitationError(guest.username, testTeam, 'This person is already a member of all the channels.', true);
            });
        });
    });

    it('MM-T1338 Invite Guests - Existing Member not on the team', () => {
        cy.apiCreateUser().then(({user: regularUser}) => {
            // # Search and add an existing member by email who is not part of the team
            invitePeople(regularUser.email, 1, regularUser.username);

            // * Verify the content and message in next screen
            verifyInvitationError(regularUser.username, testTeam, 'This person is already a member.');
        });
    });

    it('MM-T1339 Invite Guests - Existing Guest not on the team', () => {
        // # Search and add an existing guest by email, who is not part of the team
        cy.apiCreateGuestUser({}).then(({guest}) => {
            invitePeople(guest.email, 1, guest.username);

            verifyInvitationSuccess(guest.username, testTeam, 'This guest has been added to the team and channel.', true);
        });
    });

    it('MM-T1340 Invite Guests - New User not in the system', () => {
        // # Search and add a new guest by email, who is not part of the team
        const email = `temp-${getRandomId()}@mattermost.com`;
        invitePeople(email, 1, email);

        // * Verify the content and message in next screen
        verifyInvitationSuccess(email, testTeam, 'An invitation email has been sent.');
    });

    it('MM-T1394 Change Email not whitelisted for Guest user', () => {
        // # Configure a whitelisted domain
        changeGuestFeatureSettings(true, true, 'example.com');

        // # Visit to newly created team
        cy.reload();
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Invite a Guest by email
        const email = `temp-${getRandomId()}@mattermost.com`;
        invitePeople(email, 1, email);

        // * Verify the content and message in next screen
        const expectedError = `The following email addresses do not belong to an accepted domain: ${email}. Please contact your System Administrator for details.`;
        verifyInvitationError(email, testTeam, expectedError);

        // # From System Console try to update email of guest user
        cy.apiCreateGuestUser({}).then(({guest}) => {
            // # Navigate to System Console Users listing page
            cy.visit('/admin_console/user_management/users');

            // # Search for User by username and select the option to update email
            cy.get('#searchUsers').should('be.visible').type(guest.username);

            // # Click on the option to update email
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.findByTestId('userListRow').find('.MenuWrapper a').should('be.visible').click();
            cy.findByText('Update Email').should('be.visible').click();

            // * Update email outside whitelisted domain and verify error message
            cy.findByTestId('resetEmailModal').should('be.visible').within(() => {
                cy.findByTestId('resetEmailForm').should('be.visible').get('input').type(email);
                cy.findByTestId('resetEmailButton').click();
                cy.get('.error').should('be.visible').and('have.text', 'The email you provided does not belong to an accepted domain for guest accounts. Please contact your administrator or sign up with a different email.');
                cy.get('.close').click();
            });
        });
    });
});
