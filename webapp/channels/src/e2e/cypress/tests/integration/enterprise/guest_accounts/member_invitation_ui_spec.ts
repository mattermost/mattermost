// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @enterprise @guest_account

/**
 * Note: This test requires Enterprise license to be uploaded
 */

import {getRandomId, stubClipboard} from '../../../utils';
import {getAdminAccount} from '../../../support/env';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Guest Account - Member Invitation Flow', () => {
    const sysadmin = getAdminAccount();
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;

    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        // * Check if server has license for Guest Accounts
        cy.apiRequireLicenseForFeature('GuestAccounts');

        // # Enable GuestAccountSettings
        cy.apiUpdateConfig({
            GuestAccountsSettings: {
                Enable: true,
            },
            ServiceSettings: {
                EnableEmailInvitations: true,
            },
        });

        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            // # Go to town square
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T1323 Verify UI Elements of Members Invitation Flow - Accessing Invite People', () => {
        const email = `temp-${getRandomId()}@mattermost.com`;

        // # Open team menu and click 'Invite People'
        cy.uiOpenTeamMenu('Invite People');

        // * Verify UI Elements in initial step
        cy.findByTestId('invitationModal').within(() => {
            cy.get('h1').should('have.text', `Invite people to ${testTeam.display_name}`);
        });

        stubClipboard().as('clipboard');

        // * Verify share link button
        cy.findByTestId('InviteView__copyInviteLink').should('be.visible').should('have.text', 'Copy invite link').click();

        // * Verify share link url
        const baseUrl = Cypress.config('baseUrl');

        cy.get('@clipboard').its('contents').should('eq', `${baseUrl}/signup_user_complete/?id=${testTeam.invite_id}`);

        cy.get('#inviteMembersButton').scrollIntoView().should('be.visible').and('be.disabled');
        cy.get('.users-emails-input__control').should('be.visible').within(() => {
            // * Verify the input placeholder text
            cy.get('.users-emails-input__placeholder').should('have.text', 'Enter a name or email address');

            // # Type the email of the new user
            cy.get('input').typeWithForce(email);
        });
        cy.get('.users-emails-input__menu').
            children().should('have.length', 1).
            eq(0).should('contain', `Invite ${email} as a team member`).click();

        // * Verify the clicking the close icon closes the modal
        cy.get('#closeIcon').should('be.visible').click();
        cy.get('.InvitationModal').should('not.exist');
    });

    it('MM-T1324 Invite Members - Team Link - New User', () => {
        // # Wait for page to load and then logout. Else invite members link will be redirected to login page
        cy.uiGetPostTextBox().wait(TIMEOUTS.TWO_SEC);
        const inviteMembersLink = `/signup_user_complete/?id=${testTeam.invite_id}`;
        cy.apiLogout();

        // # Visit the Invite Members link
        cy.visit(inviteMembersLink);

        // * Verify the sign up options
        cy.findByText('AD/LDAP Credentials').scrollIntoView().should('be.visible');
        cy.findByText('Email address').should('be.visible');
        cy.findByPlaceholderText('Choose a Password').should('be.visible');

        // # Sign up via email
        const username = `temp-${getRandomId()}`;
        const email = `${username}@mattermost.com`;
        cy.get('#input_email').type(email);
        cy.get('#input_name').type(username);
        cy.get('#input_password-input').type('Testing123');
        cy.findByText('Create Account').click();

        // * Verify if user is added to the invited team
        cy.uiGetLHSHeader().findByText(testTeam.display_name);

        // * Verify if user has access to the default channels
        cy.uiGetLhsSection('CHANNELS').within(() => {
            cy.findByText('Off-Topic').should('be.visible');
            cy.findByText('Town Square').should('be.visible');
        });
    });

    it('MM-T1325 Invite Members - Team Link - Existing User', () => {
        // # Login as sysadmin and create a new team
        cy.apiAdminLogin();
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            // # Visit the team and wait for page to load and then logout.
            cy.visit(`/${team.name}/channels/town-square`);
            cy.uiGetPostTextBox().wait(TIMEOUTS.TWO_SEC);
            const inviteMembersLink = `/signup_user_complete/?id=${team.invite_id}`;
            cy.apiLogout();

            // # Visit the Invite Members link
            cy.visit(inviteMembersLink);

            // # Click on the login option
            cy.findByText('Log in').should('be.visible').click();

            // # Login as user
            cy.get('#input_loginId').type(testUser.username);
            cy.get('#input_password-input').type('passwd');
            cy.get('#saveSetting').should('not.be.disabled').click();

            // * Verify if user is added to the invited team
            cy.get(`#${testTeam.name}TeamButton`).as('teamButton').should('be.visible').within(() => {
                cy.get('.badge').should('be.visible').and('have.text', 1);
            });

            cy.get('@teamButton').click().wait(TIMEOUTS.TWO_SEC);

            // * Verify if user has access to the default channels in the invited teams
            cy.uiGetLhsSection('CHANNELS').within(() => {
                cy.findByText('Off-Topic').should('be.visible');
                cy.findByText('Town Square').should('be.visible');
            });
        });
    });

    it('MM-T1326 Verify Invite Members - Existing Team Member', () => {
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            // # Login as new user
            loginAsNewUser(team);

            // # Search and add an existing member by username who is part of the team
            invitePeople(sysadmin.username, 1, sysadmin.username);

            // * Verify the content and message in next screen
            verifyInvitationError(sysadmin.username, team, 'This person is already a team member.');
        });
    });

    it('MM-T1328 Invite Members - Existing Member not on the team', () => {
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            // # Login as new user
            loginAsNewUser(team);

            // # Search and add an existing member by email who is not part of the team
            invitePeople(testUser.email, 1, testUser.username);

            // * Verify the content and message in next screen
            verifyInvitationSuccess(testUser.username, team, 'This member has been added to the team.');
        });
    });

    it('MM-T1329 Invite Members - Invite People - Existing Guest not on the team', () => {
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            // # Login as new user
            loginAsNewUser(team);

            // # Search and add a new member by email who is not part of the team
            const email = `temp-${getRandomId()}@mattermost.com`;
            invitePeople(email, 1, email);

            // * Verify the content and message in next screen
            verifyInvitationSuccess(email, team, 'An invitation email has been sent.');
        });
    });

    it('MM-T4450 Invite Member via Email containing upper case letters', () => {
        // # Login as new user
        loginAsNewUser(testTeam);

        // # Invite a email containing uppercase letters
        const email = `tEMp-${getRandomId()}@mattermost.com`;
        invitePeople(email, 1, email);

        // * Verify the content and message in next screen
        verifyInvitationSuccess(email, testTeam, 'An invitation email has been sent.');
    });

    it('MM-T1330 Invite Members - New User not in the system', () => {
        // # Login as sysadmin and create a new team
        cy.apiAdminLogin();

        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            // # Login as new user
            loginAsNewUser(team);

            // # Search and add an existing member by username who is part of the team
            invitePeople(testUser.email, 1, testUser.username, false);

            // # Add a random username without proper email address format
            const username = `temp-${getRandomId()}`;
            cy.get('.users-emails-input__control').should('be.visible').within(() => {
                cy.get('input').typeWithForce(username).tab();
            });

            // # Click Invite Members
            cy.get('#inviteMembersButton').scrollIntoView().click();

            // * Verify the content and message in the Invitation Modal
            cy.findByTestId('invitationModal').within(() => {
                cy.get('h1').should('have.text', `Members invited to ${team.display_name}`);
                cy.get('div.invitation-modal-confirm--not-sent').should('be.visible').within(() => {
                    cy.get('h2 > span').should('have.text', 'Invitations Not Sent');
                    cy.get('.people-header').should('have.text', 'People');
                    cy.get('.details-header').should('have.text', 'Details');
                    cy.get('.username-or-icon').should('contain', username);
                    cy.get('.reason').should('have.text', 'Does not match a valid user or email.');
                });

                cy.get('div.invitation-modal-confirm--sent').should('be.visible').within(() => {
                    cy.get('h2 > span').should('have.text', 'Successful Invites');
                    cy.get('.people-header').should('have.text', 'People');
                    cy.get('.details-header').should('have.text', 'Details');
                    cy.get('.username-or-icon').should('contain', testUser.username);
                    cy.get('.reason').should('have.text', 'This member has been added to the team.');
                });
            });
        });
    });
});

function invitePeople(typeText, resultsCount, verifyText, clickInvite = true) {
    // # Open team menu and click 'Invite People'
    cy.uiOpenTeamMenu('Invite People');

    // # Search and add a member
    cy.get('.users-emails-input__control').should('be.visible').within(() => {
        cy.get('input').typeWithForce(typeText);
    });

    cy.get('.users-emails-input__menu').
        children().should('have.length', resultsCount).eq(0).should('contain', verifyText).click();

    cy.get('.users-emails-input__control').should('be.visible').within(() => {
        cy.get('input').tab();
    });

    // # Click Invite Members
    if (clickInvite) {
        cy.get('#inviteMembersButton').scrollIntoView().click();
    }
}

function verifyInvitationError(user, team, errorText) {
    // * Verify the content and error message in the Invitation Modal
    cy.findByTestId('invitationModal').within(() => {
        cy.get('h1').should('have.text', `Members invited to ${team.display_name}`);
        cy.get('div.invitation-modal-confirm--sent').should('not.exist');
        cy.get('div.invitation-modal-confirm--not-sent').should('be.visible').within(() => {
            cy.get('h2 > span').should('have.text', 'Invitations Not Sent');
            cy.get('.people-header').should('have.text', 'People');
            cy.get('.details-header').should('have.text', 'Details');
            cy.get('.username-or-icon').should('contain', user);
            cy.get('.reason').should('have.text', errorText);
        });
        cy.findByTestId('confirm-done').should('be.visible').and('not.be.disabled').click();
    });

    // * Verify if Invitation Modal was closed
    cy.get('.InvitationModal').should('not.exist');
}

function verifyInvitationSuccess(user, team, successText) {
    // * Verify the content and success message in the Invitation Modal
    cy.findByTestId('invitationModal').within(() => {
        cy.get('h1').should('have.text', `Members invited to ${team.display_name}`);
        cy.get('div.invitation-modal-confirm--not-sent').should('not.exist');
        cy.get('div.invitation-modal-confirm--sent').should('be.visible').within(() => {
            cy.get('h2 > span').should('have.text', 'Successful Invites');
            cy.get('.people-header').should('have.text', 'People');
            cy.get('.details-header').should('have.text', 'Details');
            cy.get('.username-or-icon').should('contain', user);
            cy.get('.reason').should('have.text', successText);
        });
        cy.findByTestId('confirm-done').should('be.visible').and('not.be.disabled').click();
    });

    // * Verify if Invitation Modal was closed
    cy.get('.InvitationModal').should('not.exist');
}

function loginAsNewUser(team) {
    // # Login as new user and get the user id
    cy.apiCreateUser().then(({user}) => {
        cy.apiAddUserToTeam(team.id, user.id);

        cy.apiLogin(user);
        cy.visit(`/${team.name}`);
    });
}
