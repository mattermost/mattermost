// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @system_console

import {getAdminAccount} from '../../../support/env';

describe('Team Scheme Channel Mentions Permissions Test', () => {
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

        // Delete any existing team override schemes
        deleteExistingTeamOverrideSchemes();
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiResetRoles();
    });

    it('MM-23018 - Create a team override scheme', () => {
        // # Visit the permissions page
        cy.visit('/admin_console/user_management/permissions/team_override_scheme');

        // # Give the new team scheme a name
        cy.get('#scheme-name').type('Test Team Scheme');

        // # Assign the new team scheme to the test team using the add teams modal
        cy.findByTestId('add-teams').click();

        cy.get('#selectItems input').typeWithForce(testTeam.display_name);

        cy.get('.team-info-block').then((el) => {
            el.click();
        });

        cy.get('#saveItems').click();

        // # Save config
        cy.get('#saveSetting').click();

        // * Ensure that the team scheme was created and assigned to the team
        cy.findByTestId('permissions-scheme-summary').within(() => {
            cy.get('.permissions-scheme-summary--header').should('include.text', 'Test Team Scheme');
            cy.get('.permissions-scheme-summary--teams').should('include.text', testTeam.display_name);
        });
    });

    it('MM-23018 - Enable and Disable Channel Mentions for team scheme', () => {
        checkChannelPermission(
            'use_channel_mentions',
            () => channelMentionsPermissionCheck(true),
            () => channelMentionsPermissionCheck(false),
            testUser,
            testTeam,
            testChannel,
        );
    });

    it('MM-24379 - Enable and Disable Create Post for team scheme -- KNOWN ISSUE:MM-42020', () => {
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
    cy.externalRequest({user: admin, method: 'put', path: `users/${user.id}/roles`, data: {roles: 'system_user'}});

    // # Get team membership
    cy.externalRequest({user: admin, method: 'put', path: `teams/${team.id}/members/${user.id}/schemeRoles`, data: {scheme_user: true, scheme_admin: teamAdmin}});

    // # Get channel membership
    cy.externalRequest({user: admin, method: 'put', path: `channels/${channel.id}/members/${user.id}/schemeRoles`, data: {scheme_user: true, scheme_admin: channelAdmin}});
};

const saveConfig = () => {
    cy.get('#saveSetting').click();
    cy.url().should('equal', `${Cypress.config('baseUrl')}/admin_console/user_management/permissions`);
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

const deleteExistingTeamOverrideSchemes = () => {
    cy.apiGetSchemes('team').then(({schemes}) => {
        schemes.forEach((scheme) => {
            cy.apiDeleteScheme(scheme.id);
        });
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
        cy.uiGetPostTextBox().should('not.be.disabled');
        cy.postMessage('test');
    } else {
        // # Ensure the input is disabled
        cy.uiGetPostTextBox().should('be.disabled');
    }

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        if (enabled) {
            // * Assert that the last message posted is not a system message informing us we are not allowed to use channel mentions
            cy.get(`#postMessageText_${postId}`).should('include.text', 'test');
        }
    });
};

const checkChannelPermission = (permissionName, hasChannelPermissionCheckFunc, notHasChannelPermissionCheckFunc, testUser, testTeam, testChannel) => {
    const channelUrl = `/${testTeam.name}/channels/${testChannel.name}`;

    // # Setup user as a regular channel member
    setUserTeamAndChannelMemberships(testUser, testTeam, testChannel);

    // * Ensure user can use channel mentions by default
    cy.apiLogin(testUser);
    cy.visit(channelUrl);
    hasChannelPermissionCheckFunc();

    // # Login as sysadmin again
    cy.apiAdminLogin();

    // # Get team scheme URL
    cy.apiGetSchemes('team').then(({schemes}) => {
        const teamScheme = schemes[0];
        const url = `admin_console/user_management/permissions/team_override_scheme/${teamScheme.id}`;

        // todo: add checks for guests once mattermost-webapp/pull/5061 is merged
        const usersTestId = `all_users-posts-${permissionName}-checkbox`;
        const channelTestId = `${teamScheme.default_channel_admin_role}-posts-${permissionName}-checkbox`;
        const teamTestId = `${teamScheme.default_team_admin_role}-posts-${permissionName}-checkbox`;
        const testIds = [usersTestId, channelTestId, teamTestId];

        // # Visit the scheme page
        cy.visit(url);

        // * Ensure permission is enabled at each scope by default
        testIds.forEach((testId) => {
            cy.findByTestId(testId).should('have.class', 'checked');
        });

        // # Remove permission from all users and save
        removePermission(usersTestId);
        saveConfig();
        cy.visit(url);

        // * Ensure that the permission is not removed for channel admins and team admins
        cy.findByTestId(usersTestId).should('not.have.class', 'checked');
        cy.findByTestId(channelTestId).should('have.class', 'checked');
        cy.findByTestId(teamTestId).should('have.class', 'checked');

        // # Remove permission for channel admins and save
        removePermission(channelTestId);
        saveConfig();
        cy.visit(url);

        // * Ensure that the permission is removed from all roles except team admins
        cy.findByTestId(teamTestId).should('have.class', 'checked');
        cy.findByTestId(channelTestId).should('not.have.class', 'checked');
        cy.findByTestId(usersTestId).should('not.have.class', 'checked');

        // # Enable permission for channel admins and save
        enablePermission(channelTestId);
        saveConfig();
        cy.visit(url);

        // * Ensure that the permission is only removed from all users
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

        // # Navigate back to team scheme as sysadmin
        cy.apiAdminLogin();
        cy.visit(url);

        // # Remove permission from channel admins and save
        removePermission(channelTestId);
        saveConfig();
        cy.visit(url);

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

        // # Navigate back to system scheme as sysadmin
        cy.apiAdminLogin();
        cy.visit(url);

        // # Remove permission from team admins and save
        removePermission(teamTestId);
        saveConfig();
        cy.visit(url);

        // # Log back in as regular user
        cy.apiLogin(testUser);
        cy.visit(channelUrl);

        // * Ensure user cannot use channel mentions as team admin
        notHasChannelPermissionCheckFunc();
    });
};
