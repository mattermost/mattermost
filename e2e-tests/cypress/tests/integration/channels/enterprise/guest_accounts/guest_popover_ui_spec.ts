// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @guest_account

/**
 * Note: This test requires Enterprise license to be uploaded
 */

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Guest Account - Guest User Badge and Popover', () => {
    let regularUser: Cypress.UserProfile;
    let guestUser: Cypress.UserProfile;
    let testTeam: Cypress.Team;
    let testChannel: Cypress.Channel;

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

        cy.apiInitSetup().then(({team, channel, user}) => {
            regularUser = user;
            testTeam = team;
            testChannel = channel;

            cy.apiCreateGuestUser({}).then(({guest}) => {
                guestUser = guest;
                cy.log(`Guest Id: ${guestUser.id}`);
                cy.log(`Guest Username ${guestUser.username}`);
                cy.apiAddUserToTeam(testTeam.id, guestUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, guestUser.id);
                });
            });

            // # Login as regular user and go to town square
            cy.apiLogin(regularUser);
            cy.visit(`/${team.name}/channels/${testChannel.name}`);
        });
    });

    it('MM-T1371 User profile popover shows guest badge', () => {
        // # Post a day old message
        cy.postMessageAs({sender: guestUser, message: 'Hello from yesterday', channelId: testChannel.id}).
            its('id').
            should('exist').
            as('yesterdaysPost');

        // * Verify Guest Badge when guest user posts a message in Center Channel
        cy.get('@yesterdaysPost').then((postId) => {
            cy.get(`#post_${postId}`).within(($el) => {
                cy.wrap($el).find('.post__header .Tag').should('be.visible');
                cy.wrap($el).find('.post__header .user-popover').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);
            });
        });
    });
});
