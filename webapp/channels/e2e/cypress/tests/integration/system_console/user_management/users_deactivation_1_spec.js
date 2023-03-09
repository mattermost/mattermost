// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @system_console

import * as MESSAGES from '../../../fixtures/messages';

describe('System Console > User Management > Deactivation', () => {
    let team1;
    let otherAdmin;

    before(() => {
        // # Do initial setup
        cy.apiInitSetup().then(({team}) => {
            team1 = team;
        });

        // # Create other sysadmin
        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            otherAdmin = sysadmin;
        });
    });

    beforeEach(() => {
        // # Login as other admin.
        cy.apiLogin(otherAdmin);

        // # Visit town-square
        cy.visit(`/${team1.name}`);
    });

    it('MM-T951 Reopened DM shows archived icon in LHS No status indicator in channel header Message box replaced with "You are viewing an archived channel with a deactivated user." in center and RHS - KNOWN ISSUE: MM-42529', () => {
        // # Create other user
        cy.apiCreateUser({prefix: 'other'}).then(({user}) => {
            // # Send a DM to the other user
            cy.sendDirectMessageToUser(user, MESSAGES.SMALL);

            // # Open RHS
            cy.clickPostCommentIcon();

            // * Verify status indicator is shown in channel header
            cy.get('#channelHeaderDescription .status').should('be.visible');

            // # Deactivate other user
            cy.apiDeactivateUser(user.id);

            // * Verify center channel message box is replace with warning
            cy.get('.channel-archived__message').contains('You are viewing an archived channel with a deactivated user. New messages cannot be posted.');

            // * Verify RHS message box is replace with warning
            cy.get('#rhsContainer .post-create-message').contains('You are viewing an archived channel with a deactivated user. New messages cannot be posted.');

            // * Verify status indicator is not shown in channel header
            cy.get('#channelHeaderDescription .status').should('not.exist');

            // * Verify archived icon is shown in LHS
            cy.uiGetLhsSection('DIRECT MESSAGES').
                find('.active').should('be.visible').
                find('.icon-archive-outline').should('be.visible');
        });
    });
});
