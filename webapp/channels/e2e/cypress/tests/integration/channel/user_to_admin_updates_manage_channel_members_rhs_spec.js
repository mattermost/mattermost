// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel

import {getAdminAccount} from '../../support/env';

describe('View Members modal', () => {
    const sysadmin = getAdminAccount();

    it('MM-20164 - Going from a Member to an Admin should update the modal', () => {
        cy.apiInitSetup().then(({team, user}) => {
            cy.apiCreateUser().then(({user: user1}) => {
                cy.apiAddUserToTeam(team.id, user1.id);
            });

            // # Promote user as a system admin
            // # Visit default channel and verify members modal
            cy.apiLogin(user);
            promoteToSysAdmin(user, sysadmin);
            cy.visit(`/${team.name}/channels/town-square`);
            verifyMemberDropdownAction(true);

            // # Make user a regular member
            // # Reload and verify members modal
            demoteToMember(user, sysadmin);
            cy.reload();
            verifyMemberDropdownAction(false);
        });
    });
});

const demoteToMember = (user, sysadmin) => {
    cy.externalRequest({user: sysadmin, method: 'put', path: `users/${user.id}/roles`, data: {roles: 'system_user'}});
};

const promoteToSysAdmin = (user, sysadmin) => {
    cy.externalRequest({user: sysadmin, method: 'put', path: `users/${user.id}/roles`, data: {roles: 'system_user system_admin'}});
};

function verifyMemberDropdownAction(hasActionItem) {
    // # Click member count to open member rhs
    cy.get('#member_rhs').click();

    cy.uiGetRHS().should('be.visible').within(() => {
        // # Click "Manage"
        cy.findByText('Manage').click();
    });

    // * Check to see any user has dropdown menu
    if (hasActionItem) {
        cy.uiGetRHS().findAllByText('Member').should('exist');
    } else {
        cy.uiGetRHS().findByText('Member').should('not.exist');
    }
}
