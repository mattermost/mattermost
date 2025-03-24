// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
import {getAdminAccount} from '../../../support/env';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

describe('Channel Type Conversion', () => {
    let testUser: UserProfile;
    let testTeam: Team;
    const admin = getAdminAccount();

    // Helper functions for permission management
    const saveConfig = () => {
        cy.waitUntil(() =>
            cy.get('#saveSetting').then((button) => {
                // Check if the button text is exactly "Save"
                if (button.text().trim() === 'Save') {
                    button.click();
                    return true; // signals waitUntil that it succeeded
                }
                return false;
            }),
        );
    };

    const enablePermission = (permissionCheckBoxTestId: string) => {
        cy.findByTestId(permissionCheckBoxTestId).then((el) => {
            if (!el.hasClass('checked')) {
                el.click();
            }
        });
    };

    const removePermission = (permissionCheckBoxTestId: string) => {
        cy.findByTestId(permissionCheckBoxTestId).then((el) => {
            if (el.hasClass('checked')) {
                el.click();
            }
        });
    };

    const promoteToChannelAdmin = (userId, channelId, admin) => {
        cy.externalRequest({
            user: admin,
            method: 'put',
            path: `channels/${channelId}/members/${userId}/schemeRoles`,
            data: {
                scheme_user: true,
                scheme_admin: true,
            },
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
        cy.wait(5000);
        cy.visit('/admin_console/user_management/permissions/system_scheme');
    };

    // Helper functions for permission setup
    const setupPermissions = (config: {
        resetToDefault?: boolean;
        publicToPrivate?: boolean;
        privateToPublic?: {
            channelAdmin?: boolean;
            teamAdmin?: boolean;
        };
        removeFromTeamAdmin?: boolean;
    }) => {
        if (config.resetToDefault) {
            resetPermissionsToDefault();
        }

        // Public to private conversion permissions
        if (config.publicToPrivate) {
            enablePermission('all_users-public_channel-convert_public_channel_to_private-checkbox');
        } else if (config.publicToPrivate === false) {
            removePermission('all_users-public_channel-convert_public_channel_to_private-checkbox');
        }

        // Private to public conversion permissions - only available to channel admins, team admins, and system admins
        if (config.privateToPublic) {
            if (config.privateToPublic.channelAdmin) {
                enablePermission('channel_admin-private_channel-convert_private_channel_to_public-checkbox');
            } else if (config.privateToPublic.channelAdmin === false) {
                removePermission('channel_admin-private_channel-convert_private_channel_to_public-checkbox');
            }

            if (config.privateToPublic.teamAdmin) {
                enablePermission('team_admin-private_channel-convert_private_channel_to_public-checkbox');
            } else if (config.privateToPublic.teamAdmin === false) {
                removePermission('team_admin-private_channel-convert_private_channel_to_public-checkbox');
            }
        }

        // Remove public to private conversion from team admin if specified
        if (config.removeFromTeamAdmin) {
            removePermission('team_admin-public_channel-convert_public_channel_to_private-checkbox');
        }

        cy.wait(1000);

        saveConfig();
    };

    // Helper functions for channel management
    const createAndVisitPublicChannel = (teamName: string, channelId: string, displayName: string): Cypress.Chainable<Channel> => {
        return cy.apiCreateChannel(testTeam.id, channelId, displayName).then(({channel}) => {
            cy.apiAddUserToChannel(channel.id, testUser.id);
            cy.visit(`/${teamName}/channels/${channel.name}`);
            return cy.wrap(channel);
        });
    };

    const createAndVisitPrivateChannel = (teamName: string, channelId: string, displayName: string): Cypress.Chainable<Channel> => {
        return cy.apiCreateChannel(testTeam.id, channelId, displayName, 'P').then(({channel}) => {
            cy.apiAddUserToChannel(channel.id, testUser.id);
            cy.visit(`/${teamName}/channels/${channel.name}`);
            return cy.wrap(channel);
        });
    };

    const visitChannel = (teamName: string, channelName: string) => {
        cy.visit(`/${teamName}/channels/${channelName}`);
    };

    // Helper functions for UI interaction
    const openChannelSettingsModal = () => {
        cy.get('#channelHeaderDropdownButton').click();
        cy.findByText('Channel Settings').click();
        cy.get('.ChannelSettingsModal').should('be.visible');
    };

    const closeChannelSettingsModal = () => {
        cy.get('.GenericModal .modal-header button[aria-label="Close"]').click();
        cy.get('.ChannelSettingsModal').should('not.exist');
    };

    const saveChannelSettings = () => {
        cy.get('[data-testid="SaveChangesPanel__save-btn"]').click();
    };

    const verifySettingsSaved = () => {
        cy.get('.SaveChangesPanel').should('contain', 'Settings saved');
    };

    // Helper functions for channel conversion
    const convertChannelToPrivate = () => {
        cy.get('#public-private-selector-button-P').click();
        cy.get('#public-private-selector-button-P').should('have.class', 'selected');
    };

    const convertChannelToPublic = () => {
        cy.get('#public-private-selector-button-O').click();
        cy.get('#public-private-selector-button-O').should('have.class', 'selected');
    };

    // Helper functions for verification
    const verifyChannelIsPrivate = (channelName: string) => {
        cy.get('.SidebarChannel').contains(channelName).parent().find('.icon-lock-outline').should('exist');
    };

    const verifyChannelIsPublic = (channelName: string) => {
        cy.get('.SidebarChannel').contains(channelName).parent().find('.icon-lock-outline').should('not.exist');
    };

    const verifyConversionOptionDisabled = (toPrivate = true) => {
        if (toPrivate) {
            cy.get('#public-private-selector-button-P').should('have.class', 'disabled');
        } else {
            cy.get('#public-private-selector-button-O').should('have.class', 'disabled');
        }
    };

    const verifyConversionOptionEnabled = (toPrivate = true) => {
        if (toPrivate) {
            cy.get('#public-private-selector-button-P').should('not.have.class', 'disabled');
        } else {
            cy.get('#public-private-selector-button-O').should('not.have.class', 'disabled');
        }
    };

    // Helper function to make user a channel admin
    const makeUserChannelAdmin = (channelId: string, userId: string) => {
        cy.apiAddUserToChannel(channelId, userId);
        promoteToChannelAdmin(userId, channelId, admin);
    };

    // Helper function to make user a team admin
    const makeUserTeamAdmin = (teamId: string, userId: string) => {
        cy.apiUpdateTeamMemberSchemeRole(teamId, userId, {scheme_admin: true, scheme_user: true});
    };

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;
        });
    });

    beforeEach(() => {
        // Reset to a clean state before each test
        cy.apiLogin(testUser);
    });

    describe('Basic Conversion Functionality', () => {
        it('MM-T3348-1 - Can convert a public channel to private', () => {
            // # Setup permissions
            setupPermissions({resetToDefault: true, publicToPrivate: true});

            // # Create and visit a public channel
            createAndVisitPublicChannel(testTeam.name, 'public-to-private', 'Public To Private').then((channel) => {
                // # Open channel settings modal
                openChannelSettingsModal();

                // # Convert to private
                convertChannelToPrivate();

                // # Save changes
                saveChannelSettings();
                verifySettingsSaved();

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now private
                verifyChannelIsPrivate(channel.display_name);
            });
        });
    });

    describe('Role-Based Channel Type Conversion', () => {
        it('MM-T3350-1 - System admin can convert a private channel to public', () => {
            // # Reset permissions to default
            resetPermissionsToDefault();

            // # Login as system admin
            cy.apiAdminLogin();

            // # Create and visit a private channel
            createAndVisitPrivateChannel(testTeam.name, 'sysadmin-private-to-public', 'SysAdmin Private To Public').then((channel) => {
                // # Open channel settings modal
                openChannelSettingsModal();

                // # Convert to public
                convertChannelToPublic();

                // # Save changes
                saveChannelSettings();
                verifySettingsSaved();

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now public
                verifyChannelIsPublic(channel.display_name);
            });
        });

        it('MM-T3350-2 - Channel admin can convert a private channel to public when they have permission', () => {
            // # Setup permissions - enable for channel admin
            setupPermissions({
                resetToDefault: true,
                privateToPublic: {
                    channelAdmin: true,
                    teamAdmin: false,
                },
            });

            // # Login as regular user
            cy.apiLogin(testUser);

            // # Create and visit a private channel
            createAndVisitPrivateChannel(testTeam.name, 'channel-admin-priv-pub', 'Channel Admin Private To Public').then((channel) => {
                // # Make test user a channel admin
                makeUserChannelAdmin(channel.id, testUser.id);

                // # Visit the channel again after role change
                visitChannel(testTeam.name, channel.name);

                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option is enabled
                verifyConversionOptionEnabled(false);

                // # Convert to public
                convertChannelToPublic();

                // # Save changes
                saveChannelSettings();
                verifySettingsSaved();

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now public
                verifyChannelIsPublic(channel.display_name);
            });
        });

        it('MM-T3350-3 - Team admin can convert a private channel to public when they have permission', () => {
            // # Setup permissions - enable for team admin
            setupPermissions({
                resetToDefault: true,
                privateToPublic: {
                    channelAdmin: false,
                    teamAdmin: true,
                },
            });

            // # Make test user a team admin
            makeUserTeamAdmin(testTeam.id, testUser.id);

            // # Login as team admin
            cy.apiLogin(testUser);

            // # Create and visit a private channel
            createAndVisitPrivateChannel(testTeam.name, 'team-admin-priv-pub', 'Team Admin Private To Public').then((channel) => {
                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option is enabled
                verifyConversionOptionEnabled(false);

                // # Convert to public
                convertChannelToPublic();

                // # Save changes
                saveChannelSettings();
                verifySettingsSaved();

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now public
                verifyChannelIsPublic(channel.display_name);
            });
        });

        it('MM-T3350-4 - Regular user cannot convert a private channel to public', () => {
            // # Reset permissions to default
            resetPermissionsToDefault();

            // # Create a new regular user specifically for this test
            cy.apiCreateUser().then(({user: regularUser}) => {
                // # Add user to the team
                cy.apiAddUserToTeam(testTeam.id, regularUser.id);

                // # Have admin create a private channel
                cy.apiAdminLogin();
                cy.apiCreateChannel(testTeam.id, 'admin-created-private', 'Admin Created Private', 'P').then(({channel}) => {
                    // # Add the regular user to the channel (as a regular member, not admin)
                    cy.apiAddUserToChannel(channel.id, regularUser.id);

                    // # Login as the regular user
                    cy.apiLogin(regularUser);

                    // # Visit the channel
                    cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                    // # Open channel settings modal
                    openChannelSettingsModal();

                    // * Verify conversion option is disabled
                    verifyConversionOptionDisabled(false);

                    // # Close the modal
                    closeChannelSettingsModal();
                });
            });
        });
    });

    describe('Permission-Based Tests', () => {
        it('MM-T3348-2 - Regular user without permission cannot convert public to private', () => {
            // # Setup permissions - remove public to private conversion permission
            setupPermissions({resetToDefault: true, publicToPrivate: false});

            // # Create a new regular user specifically for this test
            cy.apiCreateUser().then(({user: regularUser}) => {
                // # Add user to the team
                cy.apiAddUserToTeam(testTeam.id, regularUser.id);

                // # Have admin create a public channel
                cy.apiAdminLogin();
                cy.apiCreateChannel(testTeam.id, 'admin-created-public', 'Admin Created Public').then(({channel}) => {
                    // # Add the regular user to the channel (as a regular member, not admin)
                    cy.apiAddUserToChannel(channel.id, regularUser.id);

                    // # Login as the regular user
                    cy.apiLogin(regularUser);

                    // # Visit the channel
                    cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                    // # Open channel settings modal
                    openChannelSettingsModal();

                    // * Verify conversion option is disabled
                    verifyConversionOptionDisabled(true);

                    // # Close the modal
                    closeChannelSettingsModal();
                });
            });
        });

        it('MM-T3348-3 - Team admin can convert public to private by default', () => {
            // # Setup permissions - reset to default
            setupPermissions({resetToDefault: true});

            // # Make test user a team admin
            makeUserTeamAdmin(testTeam.id, testUser.id);

            // # Create and visit a public channel
            createAndVisitPublicChannel(testTeam.name, 'team-admin-convert', 'Team Admin Convert').then((channel) => {
                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option is enabled
                verifyConversionOptionEnabled(true);

                // # Convert to private
                convertChannelToPrivate();

                // # Save changes
                saveChannelSettings();
                verifySettingsSaved();

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now private
                verifyChannelIsPrivate(channel.display_name);
            });
        });

        it('MM-T3348-4 - Team admin cannot convert when permission is removed', () => {
            // # Setup permissions - remove permission from team admin
            setupPermissions({
                resetToDefault: true,
                privateToPublic: {
                    teamAdmin: false,
                },
                removeFromTeamAdmin: true,
            });

            // # Make test user a team admin
            makeUserTeamAdmin(testTeam.id, testUser.id);

            // # Have admin create a public channel
            cy.apiAdminLogin();
            cy.apiCreateChannel(testTeam.id, 'admin-created-team-admin-no-perm', 'Admin Created Team Admin No Permission').then(({channel}) => {
                // # Add the team admin user to the channel (as a regular member, not channel admin)
                cy.apiAddUserToChannel(channel.id, testUser.id);

                // # Login as the team admin user
                cy.apiLogin(testUser);

                // # Visit the channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option is disabled
                verifyConversionOptionDisabled(true);

                // # Close the modal
                closeChannelSettingsModal();
            });
        });
    });

    describe('Channel Admin Tests', () => {
        it('MM-T3349-1 - Channel admin can convert public to private regardless of permissions', () => {
            // # Setup permissions - remove public to private conversion permission
            setupPermissions({resetToDefault: true, publicToPrivate: false});

            // # Create and visit a public channel
            createAndVisitPublicChannel(testTeam.name, 'channel-admin-pub', 'Channel Admin Public').then((channel) => {
                // # Make test user a channel admin
                makeUserChannelAdmin(channel.id, testUser.id);

                // # Visit the channel again after role change
                visitChannel(testTeam.name, channel.name);

                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option is enabled (channel admin can convert regardless of permissions)
                verifyConversionOptionEnabled(true);

                // # Convert to private
                convertChannelToPrivate();

                // # Save changes
                saveChannelSettings();
                verifySettingsSaved();

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now private
                verifyChannelIsPrivate(channel.display_name);
            });
        });
    });
});
