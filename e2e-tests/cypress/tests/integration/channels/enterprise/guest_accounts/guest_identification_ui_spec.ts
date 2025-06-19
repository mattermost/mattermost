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
import dayjs from 'dayjs';

import * as TIMEOUTS from '../../../../fixtures/timeouts';
import {getAdminAccount} from '../../../../support/env';

describe('Verify Guest User Identification in different screens', () => {
    const admin = getAdminAccount();
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
                cy.apiAddUserToTeam(testTeam.id, guestUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, guestUser.id);
                });
            });

            // # Login as regular user and visit test channel
            cy.apiLogin(regularUser);
            cy.visit(`/${team.name}/channels/${testChannel.name}`);
        });
    });

    it('MM-T1370 Verify Guest Badge in Channel Members dropdown and dialog', () => {
        // # Open Channel Members RHS
        cy.get('#channelHeaderTitle').click();
        cy.get('#channelMembers').click().wait(TIMEOUTS.HALF_SEC);
        cy.uiGetRHS().findByTestId(`memberline-${guestUser.id}`).within(($el) => {
            cy.wrap($el).get('.Tag').should('be.visible').should('have.text', 'GUEST');
        });
    });

    it('Verify Guest Badge in Team Members dialog', () => {
        // # Open team menu and click 'View Members'
        cy.uiOpenTeamMenu('View members');

        cy.get('#teamMembersModal').should('be.visible').within(($el) => {
            cy.wrap($el).findAllByTestId('userListItemDetails').each(($elChild) => {
                cy.wrap($elChild).invoke('text').then((username) => {
                    // * Verify Guest Badge in Channel Members List
                    if (username === guestUser.username) {
                        cy.wrap($elChild).find('.Tag').should('be.visible').and('have.text', 'GUEST');
                    }
                });
            });

            // #Close Channel Members Dialog
            cy.wrap($el).find('.close').click();
        });
    });

    it('MM-T1372 Verify Guest Badge in Posts in Center Channel, RHS and User Profile Popovers', () => {
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Get yesterdays date in UTC
        const yesterdaysDate = dayjs().subtract(1, 'days').valueOf();

        // # Post a day old message
        cy.postMessageAs({sender: guestUser, message: 'Hello from yesterday', channelId: testChannel.id, createAt: yesterdaysDate}).
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

        // * Verify Guest Badge in Guest User's Profile Popover
        cy.get('div.user-profile-popover').should('be.visible').within(($el) => {
            cy.wrap($el).find('.GuestTag').should('be.visible').and('have.text', 'GUEST');
        });
        cy.get('button.closeButtonRelativePosition').click();

        // # Close the profile popover
        cy.get('#channel-header').click();

        // # Open RHS comment menu
        cy.get('@yesterdaysPost').then((postId) => {
            cy.clickPostCommentIcon(postId.toString());

            // * Verify Guest Badge in RHS
            cy.get(`#rhsPost_${postId}`).within(($el) => {
                cy.wrap($el).find('.post__header .Tag').should('be.visible');
            });

            // # Close RHS
            cy.uiCloseRHS();
        });
    });

    it('Verify Guest Badge in Switch Channel Dialog', () => {
        // # Open Find Channels
        cy.uiOpenFindChannels();

        // # Type the guest user name on Channel switcher input
        cy.findByRole('combobox', {name: 'quick switch input'}).type(guestUser.username).wait(TIMEOUTS.HALF_SEC);

        // * Verify if Guest badge is displayed for the guest user in the Switch Channel Dialog
        cy.get('#suggestionList').should('be.visible');
        cy.findByTestId(guestUser.username).within(($el) => {
            cy.wrap($el).find('.Tag').should('be.visible').and('have.text', 'GUEST');
        });

        // # Close Dialog
        cy.get('#quickSwitchModal').within(() => {
            cy.get('button.close[aria-label="Close"]').click();
        });
    });

    it('MM-T1377 Verify Guest Badge in DM Search dialog', () => {
        // #Click on plus icon of Direct Messages
        cy.uiAddDirectMessage().click().wait(TIMEOUTS.HALF_SEC);

        // # Search for the Guest User
        cy.focused().type(guestUser.username, {force: true}).wait(TIMEOUTS.HALF_SEC);
        cy.get('#multiSelectList').should('be.visible').within(($el) => {
            // * Verify if Guest badge is displayed in the DM Search
            cy.wrap($el).find('.Tag').should('be.visible').and('have.text', 'GUEST');
        });

        // # Close the Direct Messages dialog
        cy.get('#moreDmModal .close').click();
    });

    it('Verify Guest Badge in DM header and GM header', () => {
        // # Open a DM with Guest User
        cy.uiAddDirectMessage().click();
        cy.findByRole('dialog', {name: 'Direct Messages'}).should('be.visible').wait(TIMEOUTS.ONE_SEC);
        cy.findByRole('combobox', {name: 'Search for people'}).
            should('have.focused').
            typeWithForce(guestUser.username).
            wait(TIMEOUTS.ONE_SEC).
            typeWithForce('{enter}');
        cy.uiGetButton('Go').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify Guest Badge in DM header
        cy.get('#channelHeaderTitle').should('be.visible').find('.Tag').should('be.visible').and('have.text', 'GUEST');
        cy.get('#channelHeaderDescription').within(($el) => {
            cy.wrap($el).find('.has-guest-header').should('be.visible').and('have.text', 'Channel has guests');
        });

        // # Open a GM with Guest User and Sysadmin
        cy.uiAddDirectMessage().click();
        cy.findByRole('dialog', {name: 'Direct Messages'}).should('be.visible').wait(TIMEOUTS.ONE_SEC);
        cy.findByRole('combobox', {name: 'Search for people'}).
            should('have.focused').
            typeWithForce(guestUser.username).
            wait(TIMEOUTS.ONE_SEC).
            typeWithForce('{enter}');
        cy.findByRole('combobox', {name: 'Search for people'}).
            should('have.focused').
            typeWithForce(admin.username).
            wait(TIMEOUTS.ONE_SEC).
            typeWithForce('{enter}');
        cy.uiGetButton('Go').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify Guest Badge in GM header
        cy.get('#channelHeaderTitle').should('be.visible').find('.Tag').should('be.visible').and('have.text', 'GUEST');
        cy.get('#channelHeaderDescription').within(($el) => {
            cy.wrap($el).find('.has-guest-header').should('be.visible').and('have.text', 'This group message has guests');
        });
    });

    it('Verify Guest Badge in @mentions Autocomplete', () => {
        // # Start a draft in Channel containing "@user"
        cy.uiGetPostTextBox().type(`@${guestUser.username}`);

        // * Verify Guest Badge is displayed at mention auto-complete
        cy.get('#suggestionList').should('be.visible');
        cy.findByTestId(`mentionSuggestion_${guestUser.username}`).within(($el) => {
            cy.wrap($el).find('.Tag').should('be.visible').and('have.text', 'GUEST');
        });
    });

    it('Verify Guest Badge not displayed in Search Autocomplete', () => {
        // # Search for the Guest User
        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().type('from:');

        // * Verify Guest Badge is not displayed at Search auto-complete
        cy.contains('.suggestion-list__item', guestUser.username).scrollIntoView().should('be.visible').within(($el) => {
            cy.wrap($el).find('.Tag').should('not.exist');
        });

        // # Close and Clear the Search Autocomplete
        cy.get('#searchFormContainer').find('.input-clear-x').click({force: true});
    });
});
