// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @permissions

import * as TIMEOUTS from '../../../../fixtures/timeouts';

const deleteExistingTeamOverrideSchemes = () => {
    cy.apiGetSchemes('team').then(({schemes}) => {
        schemes.forEach((scheme) => {
            cy.apiDeleteScheme(scheme.id);
        });
    });
};

const createTeamOverrideSchemeWithPermission = (name, team, permissionId, permissionValue) => {
    cy.apiAdminLogin();

    // # Go to `User Management / Permissions` section
    cy.visit('/admin_console/user_management/permissions');

    // # Click `New Team Override Scheme`
    cy.findByTestId('team-override-schemes-link').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

    // # Type Name and Description
    cy.get('#scheme-name').should('be.visible').type(name);
    cy.get('#scheme-description').type('Description');

    // # Click `Add Teams`
    cy.findByTestId('add-teams').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

    // # Find and select testTeam
    cy.get('#selectItems input').typeWithForce(team.display_name).wait(TIMEOUTS.HALF_SEC);
    cy.get('#multiSelectList div.more-modal__row.clickable').eq(0).click().wait(TIMEOUTS.HALF_SEC);

    // # Save scheme
    cy.get('#saveItems').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

    // # Modify the permissions scheme
    cy.findByTestId(permissionId).then((el) => {
        if ((!el.hasClass('checked') && permissionValue) || (el.hasClass('checked') && !permissionValue)) {
            el.click();
        }
    });

    // # Save scheme
    cy.get('#saveSetting').click().wait(TIMEOUTS.TWO_SEC);
    cy.apiLogout();
};

describe('Team Permissions', () => {
    let testTeam;
    let testUser;
    let testPrivateCh;
    let otherUser;
    const schemeName = 'schemetest';
    before(() => {
        cy.apiRequireLicense();
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
            cy.apiCreateChannel(testTeam.id, 'private-permissions-test', 'Private Permissions Test', 'P', '').then(({channel}) => {
                cy.apiAddUserToChannel(channel.id, testUser.id);
                testPrivateCh = channel;
            });
            cy.apiCreateUser().then(({user: newUser}) => {
                otherUser = newUser;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });
        });
    });

    beforeEach(() => {
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.apiResetRoles();
        deleteExistingTeamOverrideSchemes();
    });

    it('MM-T2871 Member cannot add members to the team', () => {
        createTeamOverrideSchemeWithPermission(schemeName, testTeam, 'all_users-teams_team_scope-send_invites-checkbox', false);
        cy.apiLogin(testUser);

        // # Go to main channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open hamburger menu
        cy.uiOpenTeamMenu().wait(TIMEOUTS.HALF_SEC);

        // * Verify `Invite People` menu item is not present
        cy.get('#invitePeople').should('not.exist');

        // # Click `View Members` menu item
        cy.get('#viewMembers').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify team members modal opens
        cy.get('#teamMembersModal').should('be.visible');

        // * Verify 'Invite People` button is not present
        cy.get('#invitePeople').should('not.exist');
    });

    it('MM-T2876 Member cannot add or remove other members from private channel', () => {
        createTeamOverrideSchemeWithPermission(schemeName, testTeam, 'all_users-private_channel-manage_private_channel_members_and_read_groups-checkbox', false);
        cy.apiLogin(testUser);

        // # Go to private channel
        cy.visit(`/${testTeam.name}/channels/${testPrivateCh.name}`);

        // # Open channel header menu
        cy.uiOpenChannelMenu().wait(TIMEOUTS.HALF_SEC);

        // * Verify dropdown opens
        cy.get('#channelHeaderDropdownMenu .Menu__content.dropdown-menu').should('be.visible');

        // * Verify `Add Members` menu item is not present
        cy.get('#channelAddMembers').should('not.exist');

        // * Verify `Manage Members` menu item is not present
        cy.get('#channelManageMembers').should('not.exist');

        // * Verify `View Members` menu item is visible
        cy.get('#channelViewMembers').should('be.visible');

        // # Close channel header menu
        cy.get('body').type('{esc}');

        // # Open channel members list
        cy.get('.member-rhs__trigger').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify it does not countains Add or Manage buttons
        cy.uiGetRHS().contains('button', 'Manage').should('not.exist');
        cy.uiGetRHS().contains('button', 'Add').should('not.exist');
    });

    it('MM-T2878 Member cannot create a private channel', () => {
        createTeamOverrideSchemeWithPermission(schemeName, testTeam, 'all_users-private_channel-create_private_channel-checkbox', false);
        cy.apiLogin(testUser);

        // # Go to main channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Click on create new channel at LHS
        cy.uiBrowseOrCreateChannel('Create new channel').click();

        // * Verify that the create private channel is disabled
        cy.findByRole('dialog', {name: 'Create a new channel'}).find('#public-private-selector-button-P').should('have.class', 'disabled');
    });

    it('MM-T2900 As a Channel Admin, the test user is now able to add or remove other users from public channel', () => {
        cy.apiLogin(testUser);

        // # Create new public channel
        cy.apiCreateChannel(testTeam.id, 'public-permissions-test', 'Public Permissions Test', 'O', '').then(({channel}) => {
            // # Visit the created channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Open channel header menu
            cy.uiOpenChannelMenu().wait(TIMEOUTS.HALF_SEC);

            // * Verify dropdown opens
            cy.get('#channelHeaderDropdownMenu .Menu__content.dropdown-menu').should('be.visible');

            // # Click on `Add Members`
            cy.get('#channelAddMembers').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

            // # Search and select otherUser
            cy.get('#selectItems input').typeWithForce(otherUser.username).wait(TIMEOUTS.HALF_SEC);
            cy.get('#multiSelectList div').eq(0).click();

            // # Click `Save` button
            cy.get('#saveItems').should('be.visible').click().wait(TIMEOUTS.ONE_SEC);

            // # Open channel header menu
            cy.uiOpenChannelMenu().wait(TIMEOUTS.HALF_SEC);

            // * Verify dropdown opens
            cy.get('#channelHeaderDropdownMenu .Menu__content.dropdown-menu').should('be.visible');

            // # Click on `Manage Members`
            cy.get('#channelManageMembers').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

            // # Click on `Member`
            cy.uiGetRHS().findByTestId(`memberline-${otherUser.id}`).within(() => {
                cy.findByTestId('rolechooser').should('be.visible').and('contain.text', 'Member').click().wait(TIMEOUTS.HALF_SEC);
                cy.findByTestId('rolechooser').within(() => {
                    // * Verify the user can be removed
                    cy.get('.Menu__content.dropdown-menu .MenuItem').eq(1).should('be.visible').and('contain.text', 'Remove from Channel').click();
                });
            });
        });
    });

    it('MM-T2908 As a Team Admin, the test user is able to update the public channel Name, Header and Purpose', () => {
        cy.apiLogin(testUser);

        // # Create new team
        cy.apiCreateTeam('test-team-permissions', 'Test Team Permissions').then(({team}) => {
            // # Visit the `Off-Topic` channel in the new team
            cy.visit(`/${team.name}/channels/off-topic`);

            // # Open channel header menu
            cy.uiOpenChannelMenu().wait(TIMEOUTS.HALF_SEC);

            // * Verify dropdown opens
            cy.get('#channelHeaderDropdownMenu .Menu__content.dropdown-menu').should('be.visible');

            // * Verify `Edit Channel Header` menu item is visible
            cy.get('#channelEditHeader').should('be.visible');

            // * Verify `Edit Channel Purpose` menu item is visible
            cy.get('#channelEditPurpose').should('be.visible');

            // * Verify `Rename Channel` menu item is visible
            cy.get('#channelRename').should('be.visible');
        });
    });
});

