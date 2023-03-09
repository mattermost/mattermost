// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @guest_account

/**
 * Note: This test requires Enterprise license to be uploaded
 */

import {createPrivateChannel} from '../elasticsearch_autocomplete/helpers';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Guest Account - Guest User Experience', () => {
    let guestUser: Cypress.UserProfile;
    let privateChannel: Cypress.Channel;
    let testTeam: Cypress.Team;

    before(() => {
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

        // # Create User and Team
        cy.apiInitSetup({userPrefix: 'guest'}).then(({user, team}) => {
            guestUser = user;
            testTeam = team;
        });
    });

    it('MM-T1369 System message when user is added specifies the guest status', () => {
        // # Demote Guest user if applicable
        demoteGuestUser(guestUser);

        // # Ceate a new team
        cy.apiCreateTeam('test-team2', 'Test Team2').then(({team: teamTwo}) => {
            // # Add the guest user to this team
            cy.apiAddUserToTeam(teamTwo.id, guestUser.id).then(() => {
                // # Login as guest user
                cy.apiLogin(guestUser);
                cy.reload();
            });
        });

        // # Create Private Channel
        createPrivateChannel(testTeam.id, guestUser).then((channel) => {
            privateChannel = channel;

            cy.visit(`/${testTeam.name}/channels/${privateChannel.name}`);
        });

        // * The system message should contain 'added to the channel as a guest'
        cy.getLastPostId().then((id) => {
            cy.get(`#postMessageText_${id}`).should('contain', `@${guestUser.username} added to the channel as a guest`);
        });
    });

    it('MM-T1397 Guest tag in search in:', () => {
        demoteGuestUser(guestUser);

        cy.apiAdminLogin();
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.sendDirectMessageToUser(guestUser, 'hello');

        // # Search for the Guest User
        cy.get('#searchBox').wait(TIMEOUTS.FIVE_SEC).type(`in:${guestUser.username}`);

        // * Verify Guest Badge is not displayed at Search auto-complete
        cy.get('#search-autocomplete__popover').should('be.visible');
        cy.contains('.suggestion-list__item', guestUser.username).should('be.visible').within(($el) => {
            cy.wrap($el).find('.Tag').should('not.exist');
        });
    });
});

function demoteGuestUser(guestUser) {
    // # Demote user as guest user before each test
    cy.apiAdminLogin();
    cy.apiGetUserByEmail(guestUser.email).then(({user}) => {
        if (user.roles !== 'system_guest') {
            cy.apiDemoteUserToGuest(guestUser.id);
        }
    });
}
