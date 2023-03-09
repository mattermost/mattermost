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

import {
    changeGuestFeatureSettings,
    invitePeople,
    verifyInvitationSuccess,
} from './helpers';

describe('Guest Account - Guest User Invitation Flow', () => {
    let testTeam: Cypress.Team;
    let newUser: Cypress.UserProfile;

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

            cy.apiCreateUser().then(({user}) => {
                newUser = user;
                cy.apiAddUserToTeam(testTeam.id, newUser.id);
            });

            // # Go to town square
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T4451 Verify UI Elements of Guest User Invitation Flow', () => {
        // # Open team menu and click 'Invite People'
        cy.uiOpenTeamMenu('Invite People');

        // * Verify Invite Guest link
        cy.findByTestId('inviteGuestLink').should('be.visible').click();
        cy.findByText('Add to channels').should('be.visible');

        // * Verify the header has changed in the modal
        cy.findByTestId('invitationModal').within(() => {
            cy.get('h1').should('have.text', `Invite guests to ${testTeam.display_name}`);
        });

        // * Verify Invite Guests button is disabled by default
        cy.get('#inviteGuestButton').scrollIntoView().should('be.visible').and('be.disabled');

        // * Verify Invite People field
        const email = `temp-${getRandomId()}@mattermost.com`;
        cy.get('.users-emails-input__control').should('be.visible').within(() => {
            // * Verify the input placeholder text
            cy.get('.users-emails-input__placeholder').should('have.text', 'Enter a name or email address');

            // # Type the email of the new user
            cy.get('input').typeWithForce(email);
        });
        cy.get('.users-emails-input__menu').
            children().should('have.length', 1).
            eq(0).should('contain', `Invite ${email} as a guest`).click();

        cy.get('.channels-input__control').should('be.visible').within(() => {
            // * Verify the input placeholder text
            cy.get('.channels-input__placeholder').should('have.text', 'e.g. Town Square');

            // # Type the channel name
            cy.get('input').typeWithForce('town sq');
        });

        cy.get('.channels-input__menu').
            children().should('have.length', 1).
            eq(0).should('contain', 'Town Square').click();

        // * Verify Set Custom Message before clicking on the link
        cy.get('.AddToChannels').should('be.visible').within(() => {
            cy.get('textarea').should('not.exist');

            // #Verify link text and click on it
            cy.get('a').should('have.text', 'Set a custom message').click();
        });

        // * Verify Set Custom Message after clicking on the link
        cy.get('.AddToChannels').should('be.visible').within(() => {
            cy.get('a').should('not.exist');
            cy.get('.AddToChannels__customMessageTitle').findByText('Custom message');
            cy.get('textarea').should('be.visible');
        });
    });

    it('MM-T1386 Verify when different feature settings are disabled', () => {
        // # Disable Guest Accounts
        // # Enable Email Invitations
        changeGuestFeatureSettings(false, true);

        // # reload current page
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open team menu and click 'Invite People'
        cy.uiOpenTeamMenu('Invite People');

        // * Verify if Invite Members modal is displayed when guest account feature is disabled
        cy.findByTestId('invitationModal').find('h1').should('have.text', `Invite people to ${testTeam.display_name}`);

        // * Verify Share Link Header and helper text
        cy.findByTestId('InviteView__copyInviteLink').should('be.visible').within(() => {
            cy.findByText('Copy invite link').should('be.visible');
        });

        // # Close the Modal
        cy.get('#closeIcon').should('be.visible').click();

        // # Enable Guest Accounts
        // # Disable Email Invitations
        changeGuestFeatureSettings(true, false);

        // # Reload the current page
        cy.reload();

        const email = `temp-${getRandomId()}@mattermost.com`;
        invitePeople(email, 1, email, 'Town Square', false);

        // * Verify Invite Guests button is disabled
        cy.get('#inviteGuestButton').should('be.disabled');
    });

    it('MM-T4449 Invite Guest via Email containing upper case letters', () => {
        // # Reset Guest Feature settings
        changeGuestFeatureSettings();

        // # Visit Team page
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Invite a email containing uppercase letters
        const email = `tEMp-${getRandomId()}@mattermost.com`;
        invitePeople(email, 1, email);

        // * Verify the content and message in next screen
        verifyInvitationSuccess(email.toLowerCase(), testTeam, 'An invitation email has been sent.');
    });

    it('MM-T1414 Add Guest from Add New Members dialog', () => {
        // # Demote the user from member to guest
        cy.apiDemoteUserToGuest(newUser.id);

        // # Open team menu and click 'Invite People'
        cy.uiOpenTeamMenu('Invite People');

        // # Click invite members if needed
        cy.get('.InviteAs').findByTestId('inviteMembersLink').click();

        // # Search and add a member
        cy.get('.users-emails-input__control').should('be.visible').within(() => {
            cy.get('input').typeWithForce(newUser.username);
        });
        cy.get('.users-emails-input__menu').
            children().should('have.length', 1).eq(0).should('contain', newUser.username).click();

        // # Click Invite Members
        cy.get('#inviteMembersButton').scrollIntoView().click();

        // * Verify the content and error message in the Invitation Modal
        cy.findByTestId('invitationModal').within(() => {
            cy.get('div.invitation-modal-confirm--sent').should('not.exist');
            cy.get('div.invitation-modal-confirm--not-sent').should('be.visible').within(() => {
                cy.get('h2 > span').should('have.text', 'Invitations Not Sent');
                cy.get('.people-header').should('have.text', 'People');
                cy.get('.details-header').should('have.text', 'Details');
                cy.get('.username-or-icon').should('contain', newUser.username);
                cy.get('.reason').should('have.text', 'Contact your admin to make this guest a full member.');
                cy.get('.username-or-icon .Tag').should('be.visible').and('have.text', 'GUEST');
            });
        });
    });

    it('MM-T1415 Check invite more button available on both successful and failed invites', () => {
        // # Search and add an existing member by username who is part of the team
        invitePeople(newUser.username, 1, newUser.username);

        // * Verify the content and message in next screen
        cy.findByText('This person is already a member.').should('be.visible');

        // # Click on invite more button
        cy.findByTestId('invite-more').click();

        // * Verify the channel is preselected
        cy.get('.channels-input__control').should('be.visible').within(() => {
            cy.get('.public-channel-icon').should('be.visible');
            cy.findByText('Town Square').should('be.visible');
        });

        // * Verify the email field is empty
        const email = `temp-${getRandomId()}@mattermost.com`;
        cy.get('.users-emails-input__control').should('be.visible').within(() => {
            cy.get('.users-emails-input__multi-value').should('not.exist');
            cy.get('input').typeWithForce(email);
        });
        cy.get('.users-emails-input__menu').children().should('have.length', 1).eq(0).should('contain', email).click();

        // # Click Invite Guests Button
        cy.get('#inviteGuestButton').scrollIntoView().click();

        // * Verify invite more button is present
        cy.findByTestId('invite-more').should('be.visible');
    });
});
