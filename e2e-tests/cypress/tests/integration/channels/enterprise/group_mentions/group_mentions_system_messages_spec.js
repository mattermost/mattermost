// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @system_console @group_mentions

import ldapUsers from '../../../../fixtures/ldap_users.json';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

import {
    disablePermission,
    enablePermission,
    saveConfigForChannel,
    visitChannelConfigPage,
} from '../system_console/channel_moderation/helpers';
import {checkboxesTitleToIdMap} from '../system_console/channel_moderation/constants';

import {enableGroupMention} from './helpers';

describe('Group Mentions', () => {
    let groupID;
    let boardUser;
    let regularUser;
    let testTeam;

    before(() => {
        // * Check if server has license for LDAP Groups
        cy.apiRequireLicenseForFeature('LDAPGroups');

        // # Enable GuestAccountSettings
        cy.apiUpdateConfig({
            GuestAccountsSettings: {
                Enable: true,
            },
        });

        cy.apiInitSetup().then(({team, user}) => {
            regularUser = user;
            testTeam = team;
        });

        // # Test LDAP configuration and server connection
        // # Synchronize user attributes
        cy.apiLDAPTest();
        cy.apiLDAPSync();

        // # Link the group - board
        cy.visit('/admin_console/user_management/groups');
        cy.get('#board_group', {timeout: TIMEOUTS.ONE_MIN}).then((el) => {
            if (!el.text().includes('Edit')) {
                // # Link the Group if its not linked before
                if (el.find('.icon.fa-unlink').length > 0) {
                    el.find('.icon.fa-unlink').click();
                }
            }
        });

        // # Get board group id
        cy.apiGetGroups().then((res) => {
            res.body.forEach((group) => {
                if (group.display_name === 'board') {
                    // # Set groupID to navigate to group page directly
                    groupID = group.id;

                    // # Set allow reference false to ensure correct data for test cases
                    cy.apiPatchGroup(groupID, {allow_reference: false});
                }
            });
        });

        // # Login once as board user to ensure the user is created in the system
        boardUser = ldapUsers['board-1'];
        cy.apiLogin(boardUser);

        // # Login as sysadmin
        cy.apiAdminLogin();

        // # Add board user to test team to ensure that it exists in the team and set its preferences to skip tutorial step
        cy.apiGetUserByEmail(boardUser.email).then(({user}) => {
            cy.apiGetChannelByName(testTeam.name, 'town-square').then(({channel}) => {
                cy.apiAddUserToTeam(testTeam.id, user.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });
            });

            cy.apiSaveTutorialStep(user.id, '999');
        });
    });

    it('MM-T2456 - Group Mentions when group members are in the team but not in the channel', () => {
        const groupName = `board_test_case_${Date.now()}`;

        // # Login as sysadmin and enable group mention with the group name
        cy.apiAdminLogin();
        enableGroupMention(groupName, groupID, boardUser.email);

        // # Login as a regular user
        cy.apiLogin(regularUser);

        // # Create a new channel as a regular user
        cy.apiCreateChannel(testTeam.id, 'group-mention', 'Group Mentions').then(({channel}) => {
            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
            cy.uiGetPostTextBox();

            // # Submit a post containing the group mention
            cy.postMessage(`@${groupName} `);

            // * Verify if a system message is displayed indicating that list of members were not notified
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).should('include.text', `@${boardUser.username} did not get notified by this mention because they are not in the channel. Would you like to add them to the channel? They will have access to all message history.`);

                // * Verify if an option should be given to add them to channel
                cy.get('a.PostBody_addChannelMemberLink').should('be.visible');
            });
        });
    });

    it('MM-T2457 - Group Mentions when group members are not in the team and the channel', () => {
        const groupName = `board_test_case_${Date.now()}`;

        // # Login as sysadmin and enable group mention with the group name
        cy.apiAdminLogin();
        enableGroupMention(groupName, groupID, boardUser.email);

        // # Create a new team and channel as a sysadmin
        cy.apiCreateTeam('team', 'Test NoMember').then(({team}) => {
            cy.apiCreateChannel(team.id, 'group-mention', 'Group Mentions').then(({channel}) => {
                cy.apiCreateUser().then(({user}) => { // eslint-disable-line
                    // # Add user to the team and channel
                    cy.apiAddUserToTeam(team.id, user.id).then(() => {
                        cy.apiAddUserToChannel(channel.id, user.id);
                    });

                    // # Login as a regular user
                    cy.apiLogin(user);

                    // # Visit the channel
                    cy.visit(`/${team.name}/channels/${channel.name}`);
                    cy.uiGetPostTextBox();

                    // # Submit a post containing the group mention
                    cy.postMessage(`@${groupName} `);

                    // * Verify if a system message is displayed indicating that there are no members in this team
                    cy.getLastPostId().then((postId) => {
                        cy.get(`#postMessageText_${postId}`).
                            should('include.text', `@${groupName} has no members on this team`);

                        // * Verify that the group mention is not highlighted
                        cy.get(`#postMessageText_${postId}`).find('.mention--highlight').should('not.exist');
                    });
                });
            });
        });
    });

    it('MM-T2458 - Group Mentions when group members are not in the channel as a Guest User', () => {
        const groupName = `board_test_case_${Date.now()}`;

        // # Login as sysadmin and enable group mention with the group name
        cy.apiAdminLogin();
        enableGroupMention(groupName, groupID, boardUser.email);

        // # Enable Group Mentions for Guest Users
        cy.visit('/admin_console/user_management/permissions/system_scheme');
        cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'System Scheme');
        enablePermission('guests-guest_use_group_mentions-checkbox');
        cy.uiSaveConfig();

        // # Create a new channel as a sysadmin
        cy.apiCreateChannel(testTeam.id, 'group-mention', 'Group Mentions').then(({channel}) => {
            cy.apiCreateUser().then(({user}) => { // eslint-disable-line
                // # Add user to the team and channel
                cy.apiAddUserToTeam(testTeam.id, user.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });

                // # Demote the user as a guest user
                cy.apiDemoteUserToGuest(user.id);

                // # Login as a guest user
                cy.apiLogin(user);

                // # Visit the channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);
                cy.uiGetPostTextBox();

                // # Submit a post containing the group mention
                cy.postMessage(`@${groupName} `);

                // * Verify if a system message is displayed indicating that list of members were not notified
                cy.getLastPostId().then((postId) => {
                    cy.get(`#postMessageText_${postId}`).
                        should('include.text', `@${boardUser.username} did not get notified by this mention because they are not in the channel.`);

                    // * Verify that the option to add them to channel is not given
                    cy.get('a.PostBody_addChannelMemberLink').should('not.exist');
                });
            });
        });
    });

    it('MM-T2459 - Group Mentions when group members are not in the channel when Manage Members is disabled', () => {
        const groupName = `board_test_case_${Date.now()}`;

        // # Login as sysadmin and enable group mention with the group name
        cy.apiAdminLogin();
        enableGroupMention(groupName, groupID, boardUser.email);

        // # Create a new channel as a sysadmin
        cy.apiCreateChannel(testTeam.id, 'group-mention', 'Group Mentions').then(({channel}) => {
            // # Disable Manage Members permission for the channel
            visitChannelConfigPage(channel);
            disablePermission(checkboxesTitleToIdMap.MANAGE_MEMBERS_MEMBERS);
            saveConfigForChannel();

            // # Add regular user to the channel
            cy.apiAddUserToChannel(channel.id, regularUser.id);

            // # Login as a regular user
            cy.apiLogin(regularUser);

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
            cy.uiGetPostTextBox();

            // # Submit a post containing the group mention
            cy.postMessage(`@${groupName} `);

            // * Verify if a system message is displayed indicating that list of members were not notified
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).
                    should('include.text', `@${boardUser.username} did not get notified by this mention because they are not in the channel.`);

                // * Verify that the option to add them to channel is not given
                cy.get('a.PostBody_addChannelMemberLink').should('not.exist');
            });
        });
    });
});
