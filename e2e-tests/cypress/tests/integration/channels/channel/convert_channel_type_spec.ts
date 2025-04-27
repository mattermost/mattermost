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

describe('Channel Type Conversion (Public to Private Only)', () => {
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
        cy.wait(1000);
        cy.visit('/admin_console/user_management/permissions/system_scheme');
    };

    // Helper functions for permission setup
    const setupPermissions = (config: {
        resetToDefault?: boolean;
        publicToPrivate?: boolean;
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

    // Helper functions for UI interaction
    const saveChannelSettings = () => {
        cy.get('[data-testid="SaveChangesPanel__save-btn"]').click();
    };

    const verifySettingsSaved = () => {
        cy.get('.SaveChangesPanel').should('contain', 'Settings saved');
    };

    // Helper functions for channel conversion
    const convertChannelToPrivate = () => {
        // Select private channel type
        cy.get('#public-private-selector-button-P').click();
        cy.get('#public-private-selector-button-P').should('have.class', 'selected');

        // Save changes - this will trigger the confirmation modal
        saveChannelSettings();

        // Handle the confirmation modal that appears when converting from public to private
        cy.get('#confirmModal').should('be.visible');
        cy.get('#confirmModalButton').click();

        // Verify settings were saved
        verifySettingsSaved();
    };

    // Function kept for potential future use but not used in current tests
    // since private to public conversion is no longer allowed
    // const convertChannelToPublic = () => {
    //     cy.get('#public-private-selector-button-O').click();
    //     cy.get('#public-private-selector-button-O').should('have.class', 'selected');
    // };

    // Helper functions for verification
    const verifyChannelIsPrivate = (channelName: string) => {
        cy.get('.SidebarChannel').contains(channelName).parent().find('.icon-lock-outline').should('exist');
    };

    // Function kept for potential future use but not used in current tests
    // since private to public conversion is no longer allowed
    // const verifyChannelIsPublic = (channelName: string) => {
    //     cy.get('.SidebarChannel').contains(channelName).parent().find('.icon-lock-outline').should('not.exist');
    // };

    const verifyConversionOptionDisabled = (toPrivate = true) => {
        if (toPrivate) {
            // Wait for the UI to fully load and stabilize
            cy.wait(500);

            // Check if the button is disabled - it might have a disabled attribute or a disabled class
            cy.get('#public-private-selector-button-P').then(($el) => {
                const isDisabled = $el.hasClass('disabled') || $el.prop('disabled') === true || $el.attr('aria-disabled') === 'true';
                expect(isDisabled).to.be.true;
            });
        } else {
            // Wait for the UI to fully load and stabilize
            cy.wait(500);

            // Check if the button is disabled - it might have a disabled attribute or a disabled class
            cy.get('#public-private-selector-button-O').then(($el) => {
                const isDisabled = $el.hasClass('disabled') || $el.prop('disabled') === true || $el.attr('aria-disabled') === 'true';
                expect(isDisabled).to.be.true;
            });
        }
    };

    const verifyConversionOptionEnabled = (toPrivate = true) => {
        if (toPrivate) {
            // Wait for the UI to fully load and stabilize
            cy.wait(500);

            // Check if the button is enabled - it should not have disabled attributes or classes
            cy.get('#public-private-selector-button-P').then(($el) => {
                const isDisabled = $el.hasClass('disabled') || $el.prop('disabled') === true || $el.attr('aria-disabled') === 'true';
                expect(isDisabled).to.be.false;
            });
        } else {
            // Wait for the UI to fully load and stabilize
            cy.wait(500);

            // Check if the button is enabled - it should not have disabled attributes or classes
            cy.get('#public-private-selector-button-O').then(($el) => {
                const isDisabled = $el.hasClass('disabled') || $el.prop('disabled') === true || $el.attr('aria-disabled') === 'true';
                expect(isDisabled).to.be.false;
            });
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

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now private
                verifyChannelIsPrivate(channel.display_name);
            });
        });

        it('MM-T3348-5 - Cannot convert a private channel back to public', () => {
            // # Setup permissions
            setupPermissions({resetToDefault: true, publicToPrivate: true});

            // # Create and visit a public channel
            createAndVisitPublicChannel(testTeam.name, 'private-stays-private', 'Private Stays Private').then((channel) => {
                // # Open channel settings modal
                openChannelSettingsModal();

                // # Convert to private
                convertChannelToPrivate();

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now private
                verifyChannelIsPrivate(channel.display_name);

                // # Open channel settings modal again
                openChannelSettingsModal();

                // * Verify conversion option to public is disabled
                verifyConversionOptionDisabled(false);

                // # Close the modal
                closeChannelSettingsModal();
            });
        });
    });

    describe('Role-Based Channel Type Conversion', () => {
        it('MM-T3350-1 - System admin cannot convert a private channel to public', () => {
            // # Reset permissions to default
            resetPermissionsToDefault();

            // # Login as system admin
            cy.apiAdminLogin();

            // # Create and visit a private channel
            createAndVisitPrivateChannel(testTeam.name, 'sysadmin-private-stays-private', 'SysAdmin Private Channel').then(() => {
                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option to public is disabled
                verifyConversionOptionDisabled(false);

                // # Close the modal
                closeChannelSettingsModal();
            });
        });

        it('MM-T3350-2 - Channel admin cannot convert a private channel to public', () => {
            // # Reset permissions to default
            setupPermissions({resetToDefault: true});

            // # Login as regular user
            cy.apiLogin(testUser);

            // # Create and visit a private channel
            createAndVisitPrivateChannel(testTeam.name, 'channel-admin-private', 'Channel Admin Private').then((channel) => {
                // # Make test user a channel admin
                makeUserChannelAdmin(channel.id, testUser.id);

                // # Visit the channel again after role change
                visitChannel(testTeam.name, channel.name);

                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option to public is disabled
                verifyConversionOptionDisabled(false);

                // # Close the modal
                closeChannelSettingsModal();
            });
        });

        it('MM-T3350-3 - Team admin cannot convert a private channel to public', () => {
            // # Reset permissions to default
            setupPermissions({resetToDefault: true});

            // # Make test user a team admin
            makeUserTeamAdmin(testTeam.id, testUser.id);

            // # Login as team admin
            cy.apiLogin(testUser);

            // # Create and visit a private channel
            createAndVisitPrivateChannel(testTeam.name, 'team-admin-private', 'Team Admin Private').then(() => {
                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option to public is disabled
                verifyConversionOptionDisabled(false);

                // # Close the modal
                closeChannelSettingsModal();
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
        it('MM-T3349-1 - Channel admin can convert public to private when permission is enabled', () => {
            // # Setup permissions - enable public to private conversion permission
            setupPermissions({resetToDefault: true, publicToPrivate: true});

            // # Create and visit a public channel
            createAndVisitPublicChannel(testTeam.name, 'channel-admin-pub', 'Channel Admin Public').then((channel) => {
                // # Make test user a channel admin
                makeUserChannelAdmin(channel.id, testUser.id);

                // # Visit the channel again after role change
                visitChannel(testTeam.name, channel.name);

                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option is enabled
                verifyConversionOptionEnabled(true);

                // # Convert to private
                convertChannelToPrivate();

                // # Close the modal
                closeChannelSettingsModal();

                // * Verify channel is now private
                verifyChannelIsPrivate(channel.display_name);
            });
        });

        it('MM-T3349-2 - Channel admin cannot convert public to private when permission is removed', () => {
            // Generate a unique channel name with timestamp to avoid conflicts
            const timestamp = Date.now();
            const channelId = `channel-admin-no-perm-${timestamp}`;
            const displayName = `Channel Admin No Permission ${timestamp}`;

            // # Setup permissions - remove public to private conversion permission
            setupPermissions({resetToDefault: true, publicToPrivate: false, removeFromTeamAdmin: true});

            // # Create and visit a public channel
            createAndVisitPublicChannel(testTeam.name, channelId, displayName).then((channel) => {
                // # Make test user a channel admin
                makeUserChannelAdmin(channel.id, testUser.id);

                // # Log back in as the test user after making channel admin
                cy.apiLogin(testUser);

                // # Wait for login to complete
                cy.wait(500);

                // # Visit the channel again after role change
                visitChannel(testTeam.name, channel.name);

                // # Wait for channel to load
                cy.wait(500);

                // # Open channel settings modal
                openChannelSettingsModal();

                // * Verify conversion option is disabled
                verifyConversionOptionDisabled(true);

                // # Close the modal
                closeChannelSettingsModal();
            });
        });
    });
});
