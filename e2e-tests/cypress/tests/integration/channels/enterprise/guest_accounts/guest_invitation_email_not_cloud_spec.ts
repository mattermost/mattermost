// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @enterprise @guest_account

/**
 * Note: This test requires Enterprise license to be uploaded and an SMTP server
 * (email retrieval), so it is restricted to non-cloud editions.
 */

import type {UserProfile} from '@mattermost/types/users';

import {
    changeGuestFeatureSettings,
    invitePeople,
    verifyInvitationSuccess,
} from './helpers';

import * as TIMEOUTS from '@/fixtures/timeouts';
import {
    getJoinEmailTemplate,
    getRandomId,
    newTestPassword,
    reUrl,
    verifyEmailBody,
} from '@/utils';

describe('Guest Account - Guest User Invitation Email Flow', () => {
    let sysadmin: Cypress.UserProfile;
    let testTeam: Cypress.Team;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license for Guest Accounts
        cy.apiRequireLicenseForFeature('GuestAccounts');
    });

    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin().then(({user}: {user: UserProfile}) => {
            sysadmin = user;
        });

        // # Reset Guest Feature settings (Guest Accounts + Email Invitations enabled)
        changeGuestFeatureSettings();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            // # Go to town square
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T1340 Invite Guests - New User not in the system - join via email', () => {
        const username = `g${getRandomId()}`; // username has to start with a letter
        const email = `${username}@sample.mattermost.com`;

        // # Search and add a new guest by email, who is not part of the team
        invitePeople(email, 1, email);

        // * Verify the invitation was sent (step 1)
        verifyInvitationSuccess(email, testTeam, 'An invitation email has been sent.');

        // # Open the invitation email and extract the join link (step 2)
        cy.getRecentEmail({username, email}).then((data) => {
            const {body: actualEmailBody, subject} = data;

            // * Verify the email subject is about joining the team as a guest
            expect(subject).to.contain(`${sysadmin.username} invited you to join the team ${testTeam.display_name} as a guest`);

            // * Verify the email body matches the expected guest invite template
            const expectedEmailBody = getJoinEmailTemplate(sysadmin.username, email, testTeam, true);
            verifyEmailBody(expectedEmailBody, actualEmailBody);

            // # Extract invitation link from the invitation email
            const invitationLink = actualEmailBody[3].match(reUrl)[0];

            // # Logout as sysadmin and open the invitation link ("Join now")
            cy.apiLogout();
            cy.visit(invitationLink);
        });

        // # Create the guest account with email and password (email is pre-filled from the invite)
        cy.get('#input_name').type(username);
        cy.get('#input_password-input').type(newTestPassword());

        // # Agree to the terms and privacy policy, then create the account
        cy.findByRole('checkbox', {name: 'Terms and privacy policy checkbox'}).check({force: true});
        cy.findByText('Create account').click();

        // * Verify the guest is taken into the app and added to the team upon successful signup
        cy.get('#SidebarContainer', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // * Verify a system message indicates the guest has joined
        cy.uiWaitUntilMessagePostedIncludes(username);
    });
});
