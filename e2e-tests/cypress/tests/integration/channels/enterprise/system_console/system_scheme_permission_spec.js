// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console

import {getAdminAccount} from '../../../../support/env';

describe('System Scheme Channel Mentions Permissions Test', () => {
    let testUser;
    let testTeam;
    let testChannel;

    before(() => {
        // * Check if server has license
        cy.apiRequireLicense();

        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testTeam = team;
            testChannel = channel;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiResetRoles();
    });

    it('MM-23018 - Enable and Disable Channel Mentions', () => {
        checkChannelPermission(
            'use_channel_mentions',
            () => channelMentionsPermissionCheck(true),
            () => channelMentionsPermissionCheck(false),
            testUser,
            testTeam,
            testChannel,
        );
    });

    it('MM-24379 - Enable and Disable Create Post', () => {
        checkChannelPermission(
            'create_post',
            () => createPostPermissionCheck(true),
            () => createPostPermissionCheck(false),
            testUser,
            testTeam,
            testChannel,
        );
    });
});

const setUserTeamAndChannelMemberships = (user, team, channel, channelAdmin = false, teamAdmin = false) => {
    const admin = getAdminAccount();

    // # Set user as regular system user
    cy.externalUpdateUserRoles(user.id, 'system_user');

    // # Get team membership
    cy.externalRequest({user: admin, method: 'put', path: `teams/${team.id}/members/${user.id}/schemeRoles`, data: {scheme_user: true, scheme_admin: teamAdmin}});

    // # Get channel membership
    cy.externalRequest({user: admin, method: 'put', path: `channels/${channel.id}/members/${user.id}/schemeRoles`, data: {scheme_user: true, scheme_admin: channelAdmin}});
};

const saveConfig = () => {
    cy.get('#saveSetting').click();
    cy.waitUntil(() => cy.get('#saveSetting').then((el) => {
        return el[0].innerText === 'Save';
    }));
};

const enablePermission = (permissionCheckBoxTestId) => {
    cy.findByTestId(permissionCheckBoxTestId).then((el) => {
        if (!el.hasClass('checked')) {
            el.click();
        }
    });
};

const removePermission = (permissionCheckBoxTestId) => {
    cy.findByTestId(permissionCheckBoxTestId).then((el) => {
        if (el.hasClass('checked')) {
            el.click();
        }
    });
};

// # Checks to see if user recieved a system message warning after using @here
// # If enabled is true assumes the user has the permission enabled and checks for no system message
const channelMentionsPermissionCheck = (enabled) => {
    // # Type @here and post it to the channel
    cy.postMessage('@here ');

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        if (enabled) {
            // * Assert that the last message posted is not a system message informing us we are not allowed to use channel mentions
            cy.get(`#postMessageText_${postId}`).should('not.include.text', 'Channel notifications are disabled');
        } else {
            cy.uiWaitUntilMessagePostedIncludes('Channel notifications are disabled');

            // * Assert that the last message posted is the system message informing us we are not allowed to use channel mentions
            cy.get(`#postMessageText_${postId}`).should('include.text', 'Channel notifications are disabled');
        }
    });
};

// # Checks to see if the post input is enabled or disalbed and that the API
// accepts or rejects the create post request.
const createPostPermissionCheck = (enabled) => {
    if (enabled) {
        // # Try post it to the channel
        cy.uiGetPostTextBox().and('not.be.disabled');
        cy.postMessage('test');
    } else {
        // # Ensure the input is disabled
        cy.uiGetPostTextBox().and('be.disabled');
    }

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        if (enabled) {
            // * Assert that the last message posted is not a system message informing us we are not allowed to use channel mentions
            cy.get(`#postMessageText_${postId}`).should('include.text', 'test');
        }
    });
};

const resetPermissionsToDefault = () => {
    // # Login as sysadmin and navigate to system scheme page
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/permissions/system_scheme');

    // # Click reset to defaults and confirm
    cy.findByTestId('resetPermissionsToDefault').click();
    cy.get('#confirmModalButton').click();

    // # Save
    saveConfig();
};

const checkChannelPermission = (permissionName, hasChannelPermissionCheckFunc, notHasChannelPermissionCheckFunc, testUser, testTeam, testChannel) => {
    const guestsTestId = `guests-guest_${permissionName}-checkbox`;
    const usersTestId = `all_users-posts-${permissionName}-checkbox`;
    const channelTestId = `channel_admin-posts-${permissionName}-checkbox`;
    const teamTestId = `team_admin-posts-${permissionName}-checkbox`;
    const testIds = [guestsTestId, usersTestId, channelTestId, teamTestId];

    const channelUrl = `/${testTeam.name}/channels/${testChannel.name}`;

    // # Setup user as a regular channel member and team member
    setUserTeamAndChannelMemberships(testUser, testTeam, testChannel);

    // * Ensure user can use channel mentions by default
    cy.apiLogin(testUser);
    cy.visit(channelUrl);
    hasChannelPermissionCheckFunc();

    // # Go to system permissions scheme page as sysadmin
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/permissions/system_scheme');

    // * Ensure permission is enabled at each scope by default
    testIds.forEach((testId) => {
        cy.findByTestId(testId).should('have.class', 'checked');
    });

    // # Remove permission from guests and save
    removePermission(guestsTestId);
    saveConfig();

    // * Ensure that the permission removed is now removed
    cy.findByTestId(guestsTestId).should('not.have.class', 'checked');

    // # Remove permission from all users and save
    removePermission(usersTestId);
    saveConfig();

    // * Ensure that the permission is not removed from all roles except All Members
    cy.findByTestId(usersTestId).should('not.have.class', 'checked');
    cy.findByTestId(channelTestId).should('have.class', 'checked');
    cy.findByTestId(teamTestId).should('have.class', 'checked');

    // # Remove permission for channel admins and save
    removePermission(channelTestId);
    saveConfig();

    // * Ensure that the permission is removed from all roles except team admins
    cy.findByTestId(teamTestId).should('have.class', 'checked');
    cy.findByTestId(channelTestId).should('not.have.class', 'checked');
    cy.findByTestId(usersTestId).should('not.have.class', 'checked');

    // # Enable permission for channel admins and save
    enablePermission(channelTestId);
    saveConfig();

    // * Ensure that the permission is only removed from regular users
    cy.findByTestId(teamTestId).should('have.class', 'checked');
    cy.findByTestId(channelTestId).should('have.class', 'checked');
    cy.findByTestId(usersTestId).should('not.have.class', 'checked');

    // # Setup user as a regular channel member
    setUserTeamAndChannelMemberships(testUser, testTeam, testChannel);

    // * Ensure user cannot use channel mentions
    cy.apiLogin(testUser);
    cy.visit(channelUrl);
    notHasChannelPermissionCheckFunc();

    // # Setup user as a channel admin
    setUserTeamAndChannelMemberships(testUser, testTeam, testChannel, true, false);

    // * Ensure user can use channel mentions as channel admin
    cy.apiLogin(testUser);
    cy.visit(channelUrl);
    hasChannelPermissionCheckFunc();

    // # Navigate back to system scheme as sysadmin and remove permission from channel admins
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/permissions/system_scheme');
    removePermission(channelTestId);
    saveConfig();

    // # Log back in as regular user
    cy.apiLogin(testUser);
    cy.visit(channelUrl);

    // * Ensure user cannot use channel mentions as channel admin
    notHasChannelPermissionCheckFunc();

    // # Setup user as a team admin
    setUserTeamAndChannelMemberships(testUser, testTeam, testChannel, true, true);

    // * Ensure user can use channel mentions as team admin
    cy.apiLogin(testUser);
    cy.visit(channelUrl);
    hasChannelPermissionCheckFunc();

    // # Navigate back to system scheme as sysadmin and remove permission from team admins
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/permissions/system_scheme');
    removePermission(teamTestId);
    saveConfig();

    // # Log back in as regular user
    cy.apiLogin(testUser);
    cy.visit(channelUrl);

    // * Ensure user cannot use channel mentions as team admin
    notHasChannelPermissionCheckFunc();

    // # Reset permissions back to defaults
    resetPermissionsToDefault();
};
