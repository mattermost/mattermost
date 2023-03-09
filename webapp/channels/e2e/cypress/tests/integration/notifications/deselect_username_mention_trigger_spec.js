// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @notifications

import * as TIMEOUTS from '../../fixtures/timeouts';

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

            cy.visit(`/${testTeam.name}`);

            // # Open 'Settings' modal
            cy.uiOpenSettingsModal().within(() => {
                cy.get('#keysEdit').should('be.visible').click();

                // * As otherUser, ensure that 'Your non-case sensitive username' is not checked
                cy.get('#notificationTriggerUsername').should('not.be.checked');

                // # Close the modal
                cy.get('#accountSettingsHeader').find('button').should('be.visible').click();
            });
            cy.apiLogout();

            // # Login as sysadmin
            cy.apiAdminLogin();
            cy.visit(`/${testTeam.name}`);
        });
    });

    it('MM-T546 Words that trigger mentions - Deselect username, still get mention when added to private channel', () => {
        // # Create a new private channel
        cy.apiCreateChannel(testTeam.id, 'private-channel', 'Private Channel', 'P').then(({channel}) => {
            // # Add otherUser to the newly created private channel and logout from sysadmin account
            cy.apiAddUserToChannel(channel.id, otherUser.id);
            cy.apiLogout();

            // # Login as otherUser and visit team
            cy.apiLogin(otherUser);
            cy.visit(`/${testTeam.name}`);

            // * Verify that the channel appears in LHS
            cy.get(`#sidebarItem_${channel.name}`, {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').within(() => {
                // * Verify that the channel name is visible and is the channel otherUser was invited to
                cy.findByText(channel.display_name).should('be.visible');

                // * Ensure that the unread mentions badge is visible and has the text '1'
                cy.get('#unreadMentions').should('have.text', 1);
            });
        });
    });
});

