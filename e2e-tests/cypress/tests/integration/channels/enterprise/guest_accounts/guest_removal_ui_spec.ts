// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @guest_account

/**
 * Note: This test requires Enterprise license to be uploaded
 */

import * as TIMEOUTS from '../../../../fixtures/timeouts';

function removeUserFromAllChannels(verifyAlert, user) {
    // # Remove the Guest user from all channels of a team as a sysadmin
    const channels = ['Town Square', 'Off-Topic'];

    // # Always click on the Town Square channel first
    cy.get('#sidebarItem_town-square').click({force: true});

    channels.forEach((channel) => {
        // # Remove the Guest User from channel
        cy.getCurrentChannelId().then((channelId) => {
            cy.removeUserFromChannel(channelId, user.id);
        });

        // * Verify if guest user gets a message when the channel is removed. Does not appears when removed from last channel of the last team
        if (channel === 'Town Square' || verifyAlert) {
            cy.get('#removeFromChannelModalLabel').should('be.visible').and('have.text', `Removed from ${channel}`);
            cy.get('.modal-body').should('be.visible').contains(`removed you from ${channel}`);
            cy.get('#removedChannelBtn').should('be.visible').and('have.text', 'Okay').click().wait(TIMEOUTS.HALF_SEC);
        }
    });
}

describe('Guest Account - Guest User Removal Experience', () => {
    let team1: Cypress.Team;
    let team2: Cypress.Team;
    let guest: Cypress.UserProfile;

    before(() => {
        // * Check if server has license for Guest Accounts
        cy.apiRequireLicenseForFeature('GuestAccounts');

        cy.apiInitSetup().then(({team}) => {
            team1 = team;

            // # Create new team and visit its URL
            cy.apiCreateTeam('test-team2', 'Test Team2').then(({team}) => {
                team2 = team;
                cy.apiCreateUser().then(({user}) => {
                    guest = user;
                    cy.apiAddUserToTeam(team1.id, guest.id);
                    cy.apiAddUserToTeam(team2.id, guest.id).then(() => {
                        cy.apiLogin(guest);
                        cy.visit(`/${team2.name}/channels/town-square`);
                    });
                });
            });
        });
    });

    it('MM-T1360 Taken to login screen when removed from last channel', () => {
        // # Demote the current member to a guest user
        cy.apiAdminLogin();
        cy.apiDemoteUserToGuest(guest.id);

        // # Login as guest user
        cy.apiLogin(guest);
        cy.reload();

        // * Verify team Sidebar is visible
        cy.get('#teamSidebarWrapper').should('be.visible');

        // # Remove User from all the channels of the team as a sysadmin
        removeUserFromAllChannels(true, guest);

        // * Verify if user is automatically redirected to the other team
        cy.url().should('include', team1.name);

        // * Verify team Sidebar is not present
        cy.get('#teamSidebarWrapper').should('not.exist');

        // // # Remove User from all the channels of the team as a sysadmin
        removeUserFromAllChannels(false, guest);

        // * Verify if the user is redirected to the Select Team page
        cy.url().should('include', '/select_team');
        cy.get('.signup__content').should('be.visible').and('have.text', 'Your guest account has no channels assigned. Please contact an administrator.');

        // Login as sysadmin and verify test team 2
        cy.apiAdminLogin();
        cy.reload().visit(`/${team2.name}/channels/town-square`);

        // * Verify if status is displayed indicating guest user is removed from the channel
        cy.getLastPost().
            should('contain', 'System').
            and('contain', `You and @${guest.username} joined the team.`).
            and('contain', `@${guest.username} was removed from the channel.`);
    });
});
