// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console @channel_moderation

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import * as TIMEOUTS from '../../../../../fixtures/timeouts';
import {getRandomId} from '../../../../../utils';

import {checkboxesTitleToIdMap} from './constants';

import {
    deleteOrEditTeamScheme,
    disablePermission,
    enablePermission,
    goToPermissionsAndCreateTeamOverrideScheme,
    goToSystemScheme,
    saveConfigForChannel,
    saveConfigForScheme,
    viewManageChannelMembersRHS,
    visitChannel,
    visitChannelConfigPage,
} from './helpers';

function addButtonExists() {
    cy.uiGetRHS().contains('button', 'Add').should('be.visible');
}

function addButtonDoesNotExists() {
    cy.uiGetRHS().contains('button', 'Add').should('not.exist');
}

describe('MM-23102 - Channel Moderation - Manage Members', () => {
    let regularUser: UserProfile;
    let guestUser: UserProfile;
    let testTeam: Team;
    let testChannel: Channel;

    before(() => {
        // * Check if server has license
        cy.apiRequireLicense();
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiResetRoles();
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
        });
    });

    it('MM-T1547 No option to Manage Members for Guests', () => {
        visitChannelConfigPage(testChannel);

        // * Assert that Manage Members for Guests does not exist (checkbox is not there)
        cy.findByTestId(checkboxesTitleToIdMap.MANAGE_MEMBERS_GUESTS).should('not.exist');

        visitChannel(guestUser, testChannel, testTeam);

        // # View members rhs
        viewManageChannelMembersRHS();

        // * Add Members button does not exist
        addButtonDoesNotExists();
    });

    it('MM-T1548 Manage Members option for Members', () => {
        // # Visit test channel page and turn off the Manage members for Members and then save
        visitChannelConfigPage(testChannel);
        disablePermission(checkboxesTitleToIdMap.MANAGE_MEMBERS_MEMBERS);
        saveConfigForChannel();

        visitChannel(regularUser, testChannel, testTeam);
        viewManageChannelMembersRHS();

        // * Add Members button does not exist
        addButtonDoesNotExists();
        cy.uiGetRHS().contains('button', 'Add').should('not.exist');

        // # Visit test channel page and turn off the Manage members for Members and then save
        visitChannelConfigPage(testChannel);
        enablePermission(checkboxesTitleToIdMap.MANAGE_MEMBERS_MEMBERS);
        saveConfigForChannel();

        visitChannel(regularUser, testChannel, testTeam);
        viewManageChannelMembersRHS();

        // * Add Members button does exist
        addButtonExists();
    });

    it('MM-T1549 Manage Members option removed for Members in System Scheme', () => {
        // Edit the System Scheme and disable the Manage Members option for Members & Save.
        goToSystemScheme();
        disablePermission(checkboxesTitleToIdMap.ALL_USERS_MANAGE_PUBLIC_CHANNEL_MEMBERS);
        saveConfigForScheme();

        // # Visit test channel page
        visitChannelConfigPage(testChannel);

        // * Assert that Manage Members option should be disabled for a Members.
        // * A message Manage members for members are disabled in the System Scheme should be displayed.
        cy.findByTestId('admin-channel_settings-channel_moderation-manageMembers-disabledMember').
            should('exist').
            and('have.text', 'Manage members for members are disabled in System Scheme.');
        cy.findByTestId(checkboxesTitleToIdMap.MANAGE_MEMBERS_MEMBERS).should('be.disabled');
        cy.findByTestId(checkboxesTitleToIdMap.MANAGE_MEMBERS_GUESTS).should('not.exist');

        visitChannel(regularUser, testChannel, testTeam);
        viewManageChannelMembersRHS();

        // * Add Members button does not exist
        addButtonDoesNotExists();

        // Edit the System Scheme and enable the Manage Members option for Members & Save.
        goToSystemScheme();
        enablePermission(checkboxesTitleToIdMap.ALL_USERS_MANAGE_PUBLIC_CHANNEL_MEMBERS);
        saveConfigForScheme();

        // # Visit test channel page
        visitChannelConfigPage(testChannel);

        // * Assert that Manage Members option should be enabled for a Members.
        // * A message Manage members for members are enabled in the System Scheme should be displayed.
        cy.findByTestId('admin-channel_settings-channel_moderation-manageMembers-disabledMember').
            should('not.exist');

        visitChannel(regularUser, testChannel, testTeam);
        viewManageChannelMembersRHS();

        // * Add Members button does not exist
        addButtonExists();
    });

    it('MM-T1550 Manage Members option removed for Members in Team Override Scheme', () => {
        const teamOverrideSchemeName = `manage_members_${getRandomId()}`;

        // # Create a new team override scheme and remove manage members option for members
        goToPermissionsAndCreateTeamOverrideScheme(teamOverrideSchemeName, testTeam);

        // # Disable mange channel members
        deleteOrEditTeamScheme(teamOverrideSchemeName, 'edit');
        disablePermission(checkboxesTitleToIdMap.ALL_USERS_MANAGE_PUBLIC_CHANNEL_MEMBERS);
        saveConfigForScheme(false);
        cy.wait(TIMEOUTS.FIVE_SEC);

        // * Assert that Manage Members is disabled for members and a message is displayed
        visitChannelConfigPage(testChannel);
        cy.findByTestId('admin-channel_settings-channel_moderation-manageMembers-disabledMember').
            should('exist').
            and('have.text', `Manage members for members are disabled in ${teamOverrideSchemeName} Team Scheme.`);
        cy.findByTestId(checkboxesTitleToIdMap.MANAGE_MEMBERS_MEMBERS).should('be.disabled');
        cy.findByTestId(checkboxesTitleToIdMap.MANAGE_MEMBERS_GUESTS).should('not.exist');

        visitChannel(regularUser, testChannel, testTeam);
        viewManageChannelMembersRHS();

        // * Add Members button does not exist in manage channel members modal
        addButtonDoesNotExists();

        // # Enable manage channel members
        deleteOrEditTeamScheme(teamOverrideSchemeName, 'edit');
        enablePermission(checkboxesTitleToIdMap.ALL_USERS_MANAGE_PUBLIC_CHANNEL_MEMBERS);
        saveConfigForScheme(false);
        cy.wait(TIMEOUTS.FIVE_SEC);

        visitChannelConfigPage(testChannel);
        cy.findByTestId('admin-channel_settings-channel_moderation-manageMembers-disabledMember').
            should('not.exist');
        cy.findByTestId(checkboxesTitleToIdMap.MANAGE_MEMBERS_MEMBERS).should('have.class', 'checkbox checked');
        cy.findByTestId(checkboxesTitleToIdMap.MANAGE_MEMBERS_GUESTS).should('not.exist');

        visitChannel(regularUser, testChannel, testTeam);
        viewManageChannelMembersRHS();

        // * Add Members button does exist in manage channel members modal
        addButtonExists();
    });
});
