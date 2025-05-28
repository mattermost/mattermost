// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @not_cloud @system_console @license_removal

import * as TIMEOUTS from '../../../../../fixtures/timeouts';
import {getAdminAccount} from '../../../../../support/env';

import {promoteToChannelOrTeamAdmin} from '../channel_moderation/helpers.ts';

describe('System console', () => {
    const sysadmin = getAdminAccount();
    let teamAdmin;
    let regularUser;
    let teamName;
    let privateChannelName;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license
        cy.apiRequireLicense();

        // # Set channel permissions as listed in the test
        setChannelPermission();

        // # Create regular user and team admin
        cy.apiInitSetup({userPrefix: 'regular-user'}).then(({team, user}) => {
            teamName = team.name;
            regularUser = user;

            cy.apiCreateUser({prefix: 'team-admin'}).then(({user: newUser}) => {
                cy.apiAddUserToTeam(team.id, newUser.id).then(() => {
                    teamAdmin = newUser;
                    promoteToChannelOrTeamAdmin(teamAdmin.id, team.id, 'teams');

                    cy.apiCreateChannel(team.id, 'private', 'Private', 'P').then(({channel}) => {
                        privateChannelName = channel.name;
                        Cypress._.forEach([teamAdmin.id, regularUser.id], (userId) => cy.apiAddUserToChannel(channel.id, userId));
                    });
                });
            });
        });
    });

    it('MM-41397 - License page shows upgrade to Enterprise Advanced for Enterprise licenses', () => {
        cy.visit('/admin_console/about/license');
        cy.get('.admin-console__header').
            should('be.visible').
            and('have.text', 'Edition and License');

        // Validate Enterprise to Enterprise Advanced upgrade content
        cy.get('.EnterpriseEditionRightPannel').
            should('be.visible').
            within(() => {
                // Check the title
                cy.get('.upgrade-title').should('have.text', 'Upgrade to Enterprise Advanced');

                // Check the advantages list
                cy.findByText('Attribute-based access control');
                cy.findByText('Channel warning banners');
                cy.findByText('AD/LDAP group sync');
                cy.findByText('Advanced workflows with Playbooks');
                cy.findByText('High availability');
                cy.findByText('Advanced compliance');
                cy.findByText('And more...');
                cy.findByRole('button', {name: 'Contact sales'});
            });

        // Validate Compare plans link is not present for Enterprise licenses
        cy.findByRole('link', {name: 'Compare Plans'}).should('not.exist');
    });

    it('MM-T1201 - Remove and re-add license - Permissions freeze in place when license is removed (and then re-added)', () => {
        // * Verify user access per permissions changed while on E20
        verifyUserChannelPermission(teamName, privateChannelName, sysadmin, teamAdmin, regularUser);

        // # Remove license and verify user access when downgraded to E0/team edition
        cy.apiAdminLogin();
        cy.apiDeleteLicense();
        verifyUserChannelPermission(teamName, privateChannelName, sysadmin, teamAdmin, regularUser);

        // # Re-add license and verify user access when upgraded to E20
        cy.apiAdminLogin();
        cy.apiRequireLicense();
        verifyUserChannelPermission(teamName, privateChannelName, sysadmin, teamAdmin, regularUser);
    });
});

// # Set channel permissions as listed in the test
function setChannelPermission() {
    cy.visit('admin_console/user_management/permissions/system_scheme');
    cy.findByTestId('resetPermissionsToDefault').click();
    cy.get('#confirmModalButton').click();
    cy.findByTestId('all_users-public_channel-create_public_channel-checkbox').click();
    cy.findByTestId('all_users-private_channel-manage_private_channel_properties-checkbox').click();
    cy.findByTestId('team_admin-private_channel-manage_private_channel_properties-checkbox').click();
    cy.findByTestId('saveSetting').click();
}

function verifyCreatePublicChannel(teamName, testUsers) {
    for (const testUser of testUsers) {
        const {user, canCreate, isSysadmin} = testUser;

        // # Login as a user, and visit the team and channel
        cy.apiLogin(user);
        cy.visit(`/${teamName}/channels/town-square`);

        // # Click on create new channel at LHS
        cy.uiBrowseOrCreateChannel('Create new channel');

        cy.findByRole('dialog', {name: 'Create a new channel'}).within(() => {
            // * Verify if creating a public channel is disabled or not
            cy.get('#public-private-selector-button-O').should(isSysadmin || canCreate ? 'not.have.class' : 'have.class', 'disabled');

            // * Verify if creating a private channel is not disabled
            cy.get('#public-private-selector-button-P').should('not.have.class', 'disabled');
        });
    }
}

function verifyRenamePrivateChannel(teamName, privateChannelName, testUsers) {
    for (const testUser of testUsers) {
        const {user, canRename} = testUser;

        cy.apiLogin(user);
        cy.visit(`/${teamName}/channels/${privateChannelName}`);

        // * Click the dropdown menu and verify if the rename option is visible or not
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').click();
        cy.get('#channelRename').should(canRename ? 'be.visible' : 'not.exist');
    }
}

function verifyUserChannelPermission(teamName, privateChannelName, sysadmin, teamAdmin, regularUser) {
    // * Verify that system admin sees option to create public channels and team admins / members do not
    verifyCreatePublicChannel(teamName, [
        {user: sysadmin, canCreate: true, isSysadmin: true},
        {user: teamAdmin, canCreate: false},
        {user: regularUser, canCreate: false},
    ]);

    // * Verify that team admin and system admin see option to rename private channel, and member does not
    verifyRenamePrivateChannel(teamName, privateChannelName, [
        {user: sysadmin, canRename: true},
        {user: teamAdmin, canRename: true},
        {user: regularUser, canRename: false},
    ]);
}
