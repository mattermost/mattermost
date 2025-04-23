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

function demoteGuestUser(guestUser) {
    // # Demote user as guest user before each test
    cy.apiAdminLogin();
    cy.apiGetUserByEmail(guestUser.email).then(({user}) => {
        if (user.roles !== 'system_guest') {
            cy.apiDemoteUserToGuest(guestUser.id);
        }
    });
}

describe('Guest Account - Guest User Experience', () => {
    let guestUser: Cypress.UserProfile;

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

        cy.apiInitSetup({userPrefix: 'guest'}).then(({user, team, channel}) => {
            guestUser = user;

            // # Create new team and visit its URL
            cy.apiDemoteUserToGuest(user.id).then(() => {
                cy.apiAddUserToTeam(team.id, guestUser.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, guestUser.id).then(() => {
                        cy.apiLogin(guestUser);
                        cy.visit(`/${team.name}/channels/${channel.name}`);
                    });
                });
            });
        });
    });

    it('MM-T1354 Verify Guest User Restrictions', () => {
        // # Open team menu
        cy.uiOpenTeamMenu();

        // * Verify reduced options in Team Menu
        const missingMainOptions = [
            'Invite people',
            'Team settings',
            'Manage members',
            'Join another team',
            'Create a team',
        ];
        missingMainOptions.forEach((missingOption) => {
            cy.uiGetLHSTeamMenu().should('not.contain', missingOption);
        });

        const includeMainOptions = [
            'View members',
            'Leave team',
        ];
        includeMainOptions.forEach((includeOption) => {
            cy.uiGetLHSTeamMenu().findByText(includeOption);
        });

        // # Close the main menu
        cy.get('body').type('{esc}');

        // * Verify Reduced Options in LHS
        cy.uiGetLHSAddChannelButton().should('not.exist');

        // * Verify Guest Badge in Channel Header
        cy.get('#channelHeaderDescription').within(($el) => {
            cy.wrap($el).find('.has-guest-header').should('be.visible').and('have.text', 'Channel has guests');
        });

        // * Verify list of Users in Direct Messages Dialog
        cy.uiAddDirectMessage().click().wait(TIMEOUTS.FIVE_SEC);
        cy.get('#multiSelectList').should('be.visible').within(($el) => {
            // * Verify only 2 users - Guest and sysadmin are listed
            cy.wrap($el).children().should('have.length', 2);
        });
        cy.uiClose();

        // * Verify Guest Badge when guest user posts a message
        cy.postMessage('testing');
        cy.getLastPostId().then((postId) => {
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

        // * Verify Guest User can see only 1 additional channel in LHS plus off-topic and off-topic
        cy.uiGetLhsSection('CHANNELS').find('.SidebarChannel').should('have.length', 3);

        // * Verify list of Users a Guest User can see in Team Members dialog
        cy.uiOpenTeamMenu('View members');
        cy.get('#searchableUserListTotal').should('be.visible').and('have.text', '1 - 2 members of 2 total');
    });

    it('MM-18049 Verify Guest User Restrictions is removed when promoted', () => {
        // # Promote a Guest user to a member and reload
        cy.apiAdminLogin();
        cy.apiPromoteGuestToUser(guestUser.id);

        // # Login as guest user
        cy.apiLogin(guestUser);
        cy.reload();

        // * Verify options in team menu are changed
        cy.uiOpenTeamMenu();
        const includeOptions = [
            'Invite people',
            'View members',
            'Leave team',
            'Create a team',
        ];
        includeOptions.forEach((option) => {
            cy.uiGetLHSTeamMenu().findByText(option);
        });

        // Close the main menu with Escape key
        cy.get('body').type('{esc}');
        cy.uiGetLHSTeamMenu().should('not.exist');

        // * Verify Options in LHS are changed
        cy.uiGetLHSAddChannelButton();

        // * Verify Guest Badge in Channel Header is removed
        cy.get('#sidebarItem_off-topic').click();
        cy.get('#channelIntro').should('be.visible');
        cy.get('#channelHeaderDescription').within(($el) => {
            cy.wrap($el).find('.has-guest-header').should('not.exist');
        });

        // * Verify Guest Badge is removed when user posts a message
        cy.get('#sidebarItem_off-topic').click({force: true});
        cy.postMessage('testing');
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(($el) => {
                cy.wrap($el).find('.post__header .Tag').should('not.exist');
                cy.wrap($el).find('.post__header .user-popover').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);
            });
        });

        // * Verify Guest Badge is not displayed in User's Profile Popover
        cy.get('div.user-profile-popover').should('be.visible').within(($el) => {
            cy.wrap($el).find('.user-popover__role').should('not.exist');
        });
        cy.get('button.closeButtonRelativePosition').click();

        // # Close the profile popover
        cy.get('#channel-header').click();
    });

    it('MM-T1417 Add Guest User to New Team from System Console', () => {
        // # Demote Guest user if applicable
        demoteGuestUser(guestUser);

        // # Create a new team
        cy.apiCreateTeam('test-team2', 'Test Team2').then(({team: teamTwo}) => {
            // # Add the guest user to this team
            cy.apiAddUserToTeam(teamTwo.id, guestUser.id).then(() => {
                // # Login as guest user
                cy.apiLogin(guestUser);
                cy.reload();

                // # Click team button
                cy.get(`#${teamTwo.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

                // * Verify if Channel Not found is displayed
                cy.findByText('Channel Not Found').should('be.visible');
                cy.findByText('Your guest account has no channels assigned. Please contact an administrator.').should('be.visible');
                cy.findByText('Back').should('be.visible').click();

                // * Verify if user is redirected to a valid channel
                cy.findByTestId('post_textbox').should('be.visible');
            });
        });
    });

    it('MM-T1412 Revoke Guest User Sessions when Guest feature is disabled', () => {
        // # Demote Guest user if applicable
        demoteGuestUser(guestUser);

        // # Disable Guest Access
        cy.apiUpdateConfig({
            GuestAccountsSettings: {
                Enable: false,
            },
        });

        // # Wait for page to load and then logout
        cy.uiGetPostTextBox().wait(TIMEOUTS.TWO_SEC);
        cy.apiLogout();
        cy.visit('/');

        // # Login with guest user credentials and check the error message
        cy.get('#input_loginId').type(guestUser.username);
        cy.get('#input_password-input').type('passwd');
        cy.get('#saveSetting').should('not.be.disabled').click();

        // * Verify if guest account is deactivated
        cy.findByText('Login failed because your account has been deactivated. Please contact an administrator.').should('be.visible');
    });
});
