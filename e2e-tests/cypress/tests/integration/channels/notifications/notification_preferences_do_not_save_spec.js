// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('Notifications', () => {
    let testTeam;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            cy.apiCreateUser().then(({user}) => {
                otherUser = user;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
                cy.apiLogin(otherUser);
            });

            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T555 Notification Preferences do not save when modal is closed without saving', () => {
        // # Open Settings → Notifications → Email, select Off/Never without saving
        cy.uiOpenSettingsModal('Notifications');
        cy.get('#emailEdit').should('be.visible').click();

        // Compass Radio hides the native input (opacity:0).
        cy.get('#emailNotificationImmediately').should('exist').and('be.checked');
        cy.get('#emailNotificationNever').should('exist').and('not.be.checked').check({force: true});
        cy.wait(TIMEOUTS.HALF_SEC);

        // # Close the modal without saving
        cy.uiClose();
        cy.get('#accountSettingsModal').should('not.exist');

        // # Re-open and confirm the unsaved change was discarded
        cy.uiOpenSettingsModal('Notifications');
        cy.get('#emailEdit').should('be.visible').click();
        cy.get('#emailNotificationImmediately').should('exist').and('be.checked');
        cy.get('#emailNotificationNever').should('exist').and('not.be.checked');
    });
});
