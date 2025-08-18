// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @team_settings

describe('Invite Members', () => {
    before(() => {
        // # Enable API Team Deletion
        // # Disable Require Email Verification
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableAPITeamDeletion: true,
            },
            EmailSettings: {
                RequireEmailVerification: false,
            },
        });
    });

    describe('Invite members - backdrop click', () => {
        beforeEach(() => {
            // # Login and visit
            cy.apiAdminLogin();

            cy.visit('/');

            // # Open and select invite menu item
            cy.uiOpenTeamMenu('Invite people');
        });

        it('allows user to exit when there are no inputs', () => {
            // # Verify modal closed
            testBackdropClickCloses(true);
        });

        it('does not close modal if user has inputs', () => {
            // # Enter input into field
            cy.get('.users-emails-input__control input').typeWithForce('some.user@mattermost.com');

            // * Verify modal was not closed, and users work is preserved
            testBackdropClickCloses(false);
        });
    });
});

function testBackdropClickCloses(shouldClose) {
    // # Click on modal
    cy.get('.modal-backdrop').click({force: true});

    if (shouldClose) {
        // * Verify modal was closed
        cy.get('.InvitationModal').should('not.exist');
    } else {
        // * Verify modal was not closed
        cy.get('.InvitationModal').should('be.visible');
    }
}
