// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel

describe('Channels', () => {
    let testUser;
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;
        });
    });

    it('MM-T3348 - Convert to private channel should only be shown to users with permission', () => {
        // # Reset permissions to default
        resetPermissionsToDefault();

        // # Enable convert public channels to private for all users
        enablePermission('all_users-public_channel-convert_public_channel_to_private-checkbox');
        saveConfig();

        // # Login as a regular user
        cy.apiLogin(testUser);

        // # Create new test channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            // # Go to test channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Click the channel header dropdown
            cy.get('#channelHeaderDropdownIcon').click();

            // * Channel convert to private should be visible and confirm
            cy.get('#channelConvertToPrivate').should('be.visible').click();
            cy.findByTestId('convertChannelConfirm').should('be.visible').click();

            // # Click the channel header dropdown
            cy.get('#channelHeaderDropdownIcon').click();

            // * Channel convert to private should no longer be visible
            cy.get('#channelConvertToPrivate').should('not.exist');
        });

        // # Reset permissions to default
        resetPermissionsToDefault();

        // # Login as a regular user
        cy.apiLogin(testUser);

        // # Create new test channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            // # Go to test channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Click the channel header dropdown
            cy.get('#channelHeaderDropdownIcon').click();

            // * Channel convert to private should no longer be visible
            cy.get('#channelConvertToPrivate').should('not.exist');
        });

        // # Reset permissions to default
        resetPermissionsToDefault();

        // # Remove permission from team admins
        removePermission('team_admin-public_channel-convert_public_channel_to_private-checkbox');
        saveConfig();

        // # Promote user to team admin
        cy.apiUpdateTeamMemberSchemeRole(testTeam.id, testUser.id, {scheme_admin: true, scheme_user: true});

        // # Login as the now team admin user
        cy.apiLogin(testUser);

        // # Create new test channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            // # Go to test channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Click the channel header dropdown
            cy.get('#channelHeaderDropdownIcon').click();

            // * Channel convert to private should not be visible
            cy.get('#channelConvertToPrivate').should('not.exist');
        });

        // # Reset permissions to default
        resetPermissionsToDefault();

        // # Login as the team admin user
        cy.apiLogin(testUser);

        // # Create new test channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            // # Go to test channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Click the channel header dropdown
            cy.get('#channelHeaderDropdownIcon').click();

            // * Channel convert to private should be visible and confirm
            cy.get('#channelConvertToPrivate').should('be.visible').click();
            cy.findByTestId('convertChannelConfirm').should('be.visible').click();

            // # Click the channel header dropdown
            cy.get('#channelHeaderDropdownIcon').click();

            // * Channel convert to private should no longer be visible
            cy.get('#channelConvertToPrivate').should('not.exist');
        });
    });
});

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
