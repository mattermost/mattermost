// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications

import * as TIMEOUTS from '../../../fixtures/timeouts';

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
        // # Call function that clicks on Settings -> Notifications -> Email Notifications -> Send Email Notifications -> Never without saving
        openSettingsAndClickEmailEdit(true);

        // # Call function that checks Settings -> Notifications -> Email Notifications -> Send Email Notifications -> Never is not saved
        openSettingsAndClickEmailEdit(false);
    });

    function openSettingsAndClickEmailEdit(shouldBeClicked = false) {
        // # Open 'Settings' modal
        cy.uiOpenSettingsModal().within(() => {
            // # Click on the 'Edit' button next to Email Notifications
            cy.get('#emailEdit').click();

            if (shouldBeClicked) {
                // * Ensure that 'Send email notifications' is set to 'Immediately'
                cy.get('#emailNotificationImmediately').should('be.visible').and('be.checked');

                // # Check that 'Never' is not currently checked, and click it
                cy.get('#emailNotificationNever').should('be.visible').and('not.be.checked').click();

                // # Wait for half a second just to be sure the setting was correctly checked
                cy.wait(TIMEOUTS.HALF_SEC);

                // # Close the modal
                cy.get('#accountSettingsHeader').find('button').should('be.visible').click();
            } else {
                // * Ensure that 'Send email notifications' is set to 'Immediately'
                cy.get('#emailNotificationImmediately').should('be.visible').and('be.checked');

                // * Ensure that 'Send email notifications' is not set to 'Never'
                cy.get('#emailNotificationNever').should('be.visible').and('not.be.checked');
            }
        });
    }
});
