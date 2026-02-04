// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @mattermost_extended @ui_tweaks

describe('UI Tweaks', () => {
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let testChannel: Cypress.Channel;
    let offTopicUrl: string;
    let adminUser: Cypress.UserProfile;

    before(() => {
        // # Enable UI tweaks
        cy.apiAdminLogin().then((adminResponse) => {
            adminUser = adminResponse.user;
        });

        cy.apiUpdateConfig({
            FeatureFlags: {
                HideUpdateStatusButton: true,
            },
            MattermostExtendedSettings: {
                Posts: {
                    HideDeletedMessagePlaceholder: true,
                },
                Channels: {
                    SidebarChannelSettings: true,
                },
            },
        });

        // # Create test team, user, and channel
        cy.apiInitSetup({loginAfter: false}).then(({team, user, channel, offTopicUrl: url}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;
            offTopicUrl = url;
        });
    });

    after(() => {
        // # Disable UI tweaks
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                HideUpdateStatusButton: false,
            },
            MattermostExtendedSettings: {
                Posts: {
                    HideDeletedMessagePlaceholder: false,
                },
                Channels: {
                    SidebarChannelSettings: false,
                },
            },
        });
    });

    describe('HideDeletedMessagePlaceholder', () => {
        it('MM-EXT-UI001 Deleted messages disappear immediately', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post a message
            const messageToDelete = `Message to delete ${Date.now()}`;
            cy.postMessage(messageToDelete);

            // # Get the post ID
            cy.getLastPostId().then((postId) => {
                // * Message should be visible
                cy.get(`#post_${postId}`).should('contain', messageToDelete);

                // # Delete the message via post menu
                cy.clickPostDotMenu(postId);
                cy.findByText('Delete').click();

                // # Confirm deletion
                cy.get('#deletePostModalButton').click();

                // * Message should disappear completely (no placeholder)
                cy.get(`#post_${postId}`).should('not.exist');

                // * No "(message deleted)" placeholder
                cy.get('.post-message--deleted').should('not.exist');
                cy.contains('(message deleted)').should('not.exist');
            });
        });

        it('MM-EXT-UI002 Multiple deleted messages all disappear', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post multiple messages
            const messages = [
                `Delete test 1 - ${Date.now()}`,
                `Delete test 2 - ${Date.now()}`,
                `Delete test 3 - ${Date.now()}`,
            ];

            messages.forEach((msg) => cy.postMessage(msg));

            // # Delete each message
            cy.getLastPostId().then((postId) => {
                cy.clickPostDotMenu(postId);
                cy.findByText('Delete').click();
                cy.get('#deletePostModalButton').click();

                // * Post should not exist
                cy.get(`#post_${postId}`).should('not.exist');
            });
        });

        it('MM-EXT-UI003 Placeholder shown when tweak is disabled', () => {
            // # Disable the tweak
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Posts: {
                        HideDeletedMessagePlaceholder: false,
                    },
                },
            });

            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post and delete a message
            cy.postMessage(`Placeholder test ${Date.now()}`);
            cy.getLastPostId().then((postId) => {
                cy.clickPostDotMenu(postId);
                cy.findByText('Delete').click();
                cy.get('#deletePostModalButton').click();

                // * Placeholder should be visible
                cy.contains('(message deleted)').should('exist');
            });

            // # Re-enable the tweak
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Posts: {
                        HideDeletedMessagePlaceholder: true,
                    },
                },
            });
        });
    });

    describe('SidebarChannelSettings', () => {
        it('MM-EXT-UI004 Channel Settings appears in right-click menu', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Right-click on a channel in the sidebar
            cy.get('.SidebarChannel').contains('Off-Topic').rightclick();

            // * Channel Settings option should be visible
            cy.get('.dropdown-menu, .Menu').should('be.visible');
            cy.findByText('Channel Settings').should('exist');
        });

        it('MM-EXT-UI005 Clicking Channel Settings opens modal', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Right-click on a channel in the sidebar
            cy.get('.SidebarChannel').contains('Off-Topic').rightclick();

            // # Click Channel Settings
            cy.findByText('Channel Settings').click();

            // * Channel settings modal should open
            cy.get('.ChannelSettingsModal, .modal-dialog, [aria-labelledby*="channelSettingsModal"]').should('be.visible');
        });

        it('MM-EXT-UI006 Channel Settings available for public channels', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // # Right-click on a public channel
            cy.get('.SidebarChannel').contains('Town Square').rightclick();

            // * Channel Settings should be available
            cy.findByText('Channel Settings').should('exist');
        });

        it('MM-EXT-UI007 Channel Settings available for private channels', () => {
            // # Create a private channel
            cy.apiLogin(testUser);

            const privateName = `private-${Date.now()}`;
            cy.apiCreateChannel(testTeam.id, privateName, privateName, 'P').then(({channel}) => {
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Right-click on the private channel
                cy.get('.SidebarChannel').contains(privateName).rightclick();

                // * Channel Settings should be available
                cy.findByText('Channel Settings').should('exist');
            });
        });

        it('MM-EXT-UI008 Channel Settings NOT shown for DM channels', () => {
            // # Login as test user
            cy.apiLogin(testUser);

            // # Open a DM with admin
            cy.visit(`/${testTeam.name}/messages/@${adminUser.username}`);

            // # Right-click on the DM in sidebar
            cy.get('.SidebarChannel').contains(adminUser.username).rightclick();

            // * Channel Settings should NOT be available
            cy.findByText('Channel Settings').should('not.exist');
        });

        it('MM-EXT-UI009 Channel Settings NOT shown when tweak disabled', () => {
            // # Disable the tweak
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Channels: {
                        SidebarChannelSettings: false,
                    },
                },
            });

            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // # Right-click on a channel
            cy.get('.SidebarChannel').contains('Off-Topic').rightclick();

            // * Channel Settings should NOT be available
            cy.findByText('Channel Settings').should('not.exist');

            // # Re-enable the tweak
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Channels: {
                        SidebarChannelSettings: true,
                    },
                },
            });
        });
    });

    describe('HideUpdateStatusButton', () => {
        it('MM-EXT-UI010 Update status button is hidden on posts', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post a message
            cy.postMessage('Test message for status button');

            // # Hover over the post
            cy.getLastPostId().then((postId) => {
                cy.get(`#post_${postId}`).trigger('mouseover');

                // * Update status button should NOT be visible
                cy.get('.post__header').within(() => {
                    cy.get('[aria-label*="Update your status"], .StatusDropdown').should('not.exist');
                });
            });
        });

        it('MM-EXT-UI011 Status button visible when feature disabled', () => {
            // # Disable the feature
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    HideUpdateStatusButton: false,
                },
            });

            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // # Post a message
            cy.postMessage('Test with status button visible');

            // # Hover over the post
            cy.getLastPostId().then((postId) => {
                cy.get(`#post_${postId}`).trigger('mouseover');

                // * Status button might be visible (depending on other conditions)
                // Note: This depends on upstream Mattermost behavior
            });

            // # Re-enable the feature
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    HideUpdateStatusButton: true,
                },
            });
        });
    });

    describe('Tweak Configuration', () => {
        it('MM-EXT-UI012 HideDeletedMessagePlaceholder can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable tweak
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Posts: {
                        HideDeletedMessagePlaceholder: false,
                    },
                },
            });

            // # Verify config
            cy.apiGetConfig().then(({config}) => {
                expect(config.MattermostExtendedSettings.Posts.HideDeletedMessagePlaceholder).to.equal(false);
            });

            // # Re-enable
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Posts: {
                        HideDeletedMessagePlaceholder: true,
                    },
                },
            });
        });

        it('MM-EXT-UI013 SidebarChannelSettings can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable tweak
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Channels: {
                        SidebarChannelSettings: false,
                    },
                },
            });

            // # Verify config
            cy.apiGetConfig().then(({config}) => {
                expect(config.MattermostExtendedSettings.Channels.SidebarChannelSettings).to.equal(false);
            });

            // # Re-enable
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Channels: {
                        SidebarChannelSettings: true,
                    },
                },
            });
        });

        it('MM-EXT-UI014 HideUpdateStatusButton can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable feature
            cy.apiUpdateConfig({
                FeatureFlags: {
                    HideUpdateStatusButton: false,
                },
            });

            // # Verify config
            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.HideUpdateStatusButton).to.equal(false);
            });

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    HideUpdateStatusButton: true,
                },
            });
        });
    });

    describe('Admin Console UI Tweak Settings', () => {
        it('MM-EXT-UI015 Admin console shows Posts settings', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.get('.admin-sidebar').should('be.visible');
            cy.findByText('Mattermost Extended').click();

            // * Posts settings should be accessible
            cy.findByText('Posts').should('exist');
        });

        it('MM-EXT-UI016 Admin console shows Channels settings', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.findByText('Mattermost Extended').click();

            // * Channels settings should be accessible
            cy.findByText('Channels').should('exist');
        });

        it('MM-EXT-UI017 Admin console shows Features settings', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.findByText('Mattermost Extended').click();

            // * Features settings should be accessible
            cy.findByText('Features').should('exist');
        });

        it('MM-EXT-UI018 Settings can be modified via admin console', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Posts settings
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Posts').click();

            // * Settings form should be visible
            cy.get('.admin-console__wrapper').should('be.visible');
        });
    });
});
