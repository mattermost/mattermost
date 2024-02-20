// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Invites a member to the current team
 * @param {string} username - the username
 */
function uiInviteMemberToCurrentTeam(username: string) {
    // # Open member invite screen
    cy.uiOpenTeamMenu('Invite People');

    // # Open members section if licensed for guest accounts
    cy.findByTestId('invitationModal').
        then((container) => container.find('[data-testid="inviteMembersLink"]')).
        then((link) => link?.click());

    // # Enter bot username and submit
    cy.get('.users-emails-input__control input').typeWithForce(username).as('input');
    cy.get('.users-emails-input__option ').contains(`@${username}`);
    cy.get('@input').typeWithForce('{enter}');
    cy.findByTestId('inviteButton').click();

    // * Verify user invited to team
    cy.get('.invitation-modal-confirm--sent .InviteResultRow').
        should('contain.text', `@${username}`).
        and('contain.text', 'This member has been added to the team.');

    // # Close, return
    cy.findByTestId('confirm-done').click();
}
Cypress.Commands.add('uiInviteMemberToCurrentTeam', uiInviteMemberToCurrentTeam);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            uiInviteMemberToCurrentTeam: typeof uiInviteMemberToCurrentTeam;
        }
    }
}

export {};
