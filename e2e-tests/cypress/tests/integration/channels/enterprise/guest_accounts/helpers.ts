// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function changeGuestFeatureSettings(featureFlag = true, emailInvitation = true, whitelistedDomains = '') {
    // # Update Guest Accounts, Email Invitations, and Whitelisted Domains
    cy.apiUpdateConfig({
        GuestAccountsSettings: {
            Enable: featureFlag,
            RestrictCreationToDomains: whitelistedDomains,
        },
        ServiceSettings: {
            EnableEmailInvitations: emailInvitation,
        },
    });
}

export function invitePeople(typeText: string, resultsCount: number, verifyText: string, channelName = 'Town Square', clickInvite = true) {
    // # Open team menu and click 'Invite People'
    cy.uiOpenTeamMenu('Invite People');

    // # Click on the next icon to invite guest
    cy.findByTestId('inviteGuestLink').click();

    // # Search and add a user
    cy.get('.users-emails-input__control').should('be.visible').within(() => {
        cy.get('input').typeWithForce(typeText);
    });
    cy.get('.users-emails-input__menu').
        children().should('have.length', resultsCount).eq(0).should('contain', verifyText).click();

    // # Search and add a Channel
    cy.get('.channels-input__control').should('be.visible').within(() => {
        cy.get('input').typeWithForce(channelName);
    });
    cy.get('.channels-input__menu').
        children().should('have.length', 1).
        eq(0).should('contain', channelName).click();

    if (clickInvite) {
        // # Click Invite Guests Button
        cy.findByTestId('inviteButton').scrollIntoView().click();
    }
}

export function verifyInvitationError(user: string, team: Cypress.Team, errorText: string, verifyGuestBadge = false) {
    // * Verify the content and error message in the Invitation Modal
    cy.findByTestId('invitationModal').within(() => {
        cy.get('h1').should('have.text', `Guests invited to ${team.display_name}`);
        cy.get('div.invitation-modal-confirm--sent').should('not.exist');
        cy.get('div.invitation-modal-confirm--not-sent').should('be.visible').within(() => {
            cy.get('h2 > span').should('have.text', 'Invitations Not Sent');
            cy.get('.people-header').should('have.text', 'People');
            cy.get('.details-header').should('have.text', 'Details');
            cy.get('.username-or-icon').should('contain', user);
            cy.get('.reason').should('have.text', errorText);
            if (verifyGuestBadge) {
                cy.get('.username-or-icon .Tag').should('be.visible').and('have.text', 'GUEST');
            }
        });
        cy.findByTestId('confirm-done').should('be.visible').and('not.be.disabled').click();
    });

    // * Verify if Invitation Modal was closed
    cy.get('.InvitationModal').should('not.exist');
}

export function verifyInvitationSuccess(user: string, team: Cypress.Team, successText: string, verifyGuestBadge = false) {
    // * Verify the content and success message in the Invitation Modal
    cy.findByTestId('invitationModal').within(() => {
        cy.get('h1').should('have.text', `Guests invited to ${team.display_name}`);
        cy.get('div.invitation-modal-confirm--not-sent').should('not.exist');
        cy.get('div.invitation-modal-confirm--sent').should('be.visible').within(() => {
            cy.get('h2 > span').should('have.text', 'Successful Invites');
            cy.get('.people-header').should('have.text', 'People');
            cy.get('.details-header').should('have.text', 'Details');
            cy.get('.username-or-icon').should('contain', user);
            cy.get('.reason').should('have.text', successText);
            if (verifyGuestBadge) {
                cy.get('.username-or-icon .Tag').should('be.visible').and('have.text', 'GUEST');
            }
        });
        cy.findByTestId('confirm-done').should('be.visible').and('not.be.disabled').click();
    });

    // * Verify if Invitation Modal was closed
    cy.get('.InvitationModal').should('not.exist');
}

export function verifyGuest(userStatus = 'Guest ') {
    // * Verify if Guest User is displayed
    cy.findAllByTestId('userListRow').should('have.length', 1);
    cy.findByTestId('userListRow').find('.MenuWrapper a').should('be.visible').and('have.text', userStatus);
}
