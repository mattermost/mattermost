// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @mattermost_extended @custom_channel_icons

describe('Custom Channel Icons', () => {
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let testChannel: Cypress.Channel;
    let channelUrl: string;
    let createdIconId: string;

    before(() => {
        // # Enable custom channel icons feature flag
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                CustomChannelIcons: true,
            },
        });

        // # Create test team, user, and channel
        cy.apiInitSetup({loginAfter: false}).then(({team, user, channel, channelUrl: url}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;
            channelUrl = url;
        });
    });

    after(() => {
        // # Clean up created icon if it exists
        if (createdIconId) {
            cy.apiAdminLogin();
            cy.request({
                url: `/api/v4/custom_channel_icons/${createdIconId}`,
                method: 'DELETE',
                failOnStatusCode: false,
            });
        }

        // # Disable custom channel icons feature flag
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                CustomChannelIcons: false,
            },
        });
    });

    describe('API - Custom SVG Management', () => {
        it('MM-EXT-CI001 Admin can create custom SVG icon', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Create a custom icon
            const testSvg = btoa('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>');
            cy.request({
                url: '/api/v4/custom_channel_icons',
                method: 'POST',
                body: {
                    name: 'Test Circle Icon',
                    svg: testSvg,
                    normalize_color: true,
                },
            }).then((response) => {
                expect(response.status).to.equal(201);
                expect(response.body.id).to.not.be.empty;
                expect(response.body.name).to.equal('Test Circle Icon');
                expect(response.body.svg).to.equal(testSvg);
                expect(response.body.normalize_color).to.equal(true);
                createdIconId = response.body.id;
            });
        });

        it('MM-EXT-CI002 Admin can retrieve all custom icons', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Get all custom icons
            cy.request('/api/v4/custom_channel_icons').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body).to.be.an('array');

                // * Should include our created icon
                if (createdIconId) {
                    const foundIcon = response.body.find((icon: {id: string}) => icon.id === createdIconId);
                    expect(foundIcon).to.exist;
                }
            });
        });

        it('MM-EXT-CI003 Admin can update custom icon', () => {
            // # Skip if no icon was created
            if (!createdIconId) {
                cy.log('Skipping - no icon created');
                return;
            }

            // # Login as admin
            cy.apiAdminLogin();

            // # Update the icon
            cy.request({
                url: `/api/v4/custom_channel_icons/${createdIconId}`,
                method: 'PUT',
                body: {
                    name: 'Updated Circle Icon',
                },
            }).then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body.name).to.equal('Updated Circle Icon');
            });
        });

        it('MM-EXT-CI004 Non-admin cannot create custom icon', () => {
            // # Login as regular user
            cy.apiLogin(testUser);

            // # Attempt to create a custom icon
            const testSvg = btoa('<svg viewBox="0 0 24 24"><rect width="20" height="20"/></svg>');
            cy.request({
                url: '/api/v4/custom_channel_icons',
                method: 'POST',
                body: {
                    name: 'User Icon',
                    svg: testSvg,
                },
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });
        });

        it('MM-EXT-CI005 Non-admin cannot delete custom icon', () => {
            // # Skip if no icon was created
            if (!createdIconId) {
                cy.log('Skipping - no icon created');
                return;
            }

            // # Login as regular user
            cy.apiLogin(testUser);

            // # Attempt to delete the icon
            cy.request({
                url: `/api/v4/custom_channel_icons/${createdIconId}`,
                method: 'DELETE',
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });
        });

        it('MM-EXT-CI006 Regular user can view custom icons', () => {
            // # Login as regular user
            cy.apiLogin(testUser);

            // # Get all custom icons
            cy.request('/api/v4/custom_channel_icons').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body).to.be.an('array');
            });
        });
    });

    describe('Feature Flag', () => {
        it('MM-EXT-CI007 Returns 403 when feature is disabled', () => {
            // # Disable custom channel icons
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    CustomChannelIcons: false,
                },
            });

            // # Attempt to get custom icons
            cy.request({
                url: '/api/v4/custom_channel_icons',
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });

            // # Re-enable for subsequent tests
            cy.apiUpdateConfig({
                FeatureFlags: {
                    CustomChannelIcons: true,
                },
            });
        });
    });

    describe('UI - Channel Settings Icon Tab', () => {
        it('MM-EXT-CI008 Channel settings modal shows Icon tab when feature enabled', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(channelUrl);

            // # Open channel settings modal
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Edit Channel').click();

            // # Wait for modal to open
            cy.get('.channel-settings-modal').should('be.visible');

            // * Icon tab should be visible
            cy.findByRole('tab', {name: /icon/i}).should('exist');
        });

        it('MM-EXT-CI009 Icon tab shows library tabs', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(channelUrl);

            // # Open channel settings modal and go to Icon tab
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Edit Channel').click();
            cy.get('.channel-settings-modal').should('be.visible');
            cy.findByRole('tab', {name: /icon/i}).click();

            // * Should show library tabs
            cy.get('.ChannelSettingsIconTab__libraryTabs').should('be.visible');
            cy.get('.ChannelSettingsIconTab__libraryTab').should('have.length.at.least', 3);
        });

        it('MM-EXT-CI010 Can search for icons', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(channelUrl);

            // # Open channel settings modal and go to Icon tab
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Edit Channel').click();
            cy.get('.channel-settings-modal').should('be.visible');
            cy.findByRole('tab', {name: /icon/i}).click();

            // # Search for an icon
            cy.get('.ChannelSettingsIconTab__search input').type('home');

            // * Should show search results
            cy.get('.ChannelSettingsIconTab__iconsGrid').should('be.visible');
            cy.get('.ChannelSettingsIconTab__iconButton').should('have.length.at.least', 1);
        });

        it('MM-EXT-CI011 Can select an icon from library', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(channelUrl);

            // # Open channel settings modal and go to Icon tab
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Edit Channel').click();
            cy.get('.channel-settings-modal').should('be.visible');
            cy.findByRole('tab', {name: /icon/i}).click();

            // # Click on MDI tab and select first icon
            cy.get('.ChannelSettingsIconTab__libraryTab').contains('MDI').click();
            cy.get('.ChannelSettingsIconTab__iconButton').first().click();

            // * Icon should be selected (preview should update)
            cy.get('.ChannelSettingsIconTab__previewIcon').should('not.contain', 'Default');

            // * Save button should be enabled
            cy.get('.SaveChangesPanel').should('be.visible');
        });

        it('MM-EXT-CI012 Can clear selected icon', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(channelUrl);

            // # Open channel settings modal and go to Icon tab
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Edit Channel').click();
            cy.get('.channel-settings-modal').should('be.visible');
            cy.findByRole('tab', {name: /icon/i}).click();

            // # Select an icon first
            cy.get('.ChannelSettingsIconTab__libraryTab').contains('MDI').click();
            cy.get('.ChannelSettingsIconTab__iconButton').first().click();

            // # Clear the icon
            cy.get('.ChannelSettingsIconTab__clearButton').click();

            // * Preview should show default
            cy.get('.ChannelSettingsIconTab__previewLabel').should('contain', 'Default');
        });

        it('MM-EXT-CI013 Custom SVG tab shows add button when empty', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(channelUrl);

            // # Open channel settings modal and go to Icon tab
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Edit Channel').click();
            cy.get('.channel-settings-modal').should('be.visible');
            cy.findByRole('tab', {name: /icon/i}).click();

            // # Click on Custom SVG tab
            cy.get('.ChannelSettingsIconTab__libraryTab').contains('Custom SVG').click();

            // * Should show empty state or add button
            cy.get('.ChannelSettingsIconTab__customContent').should('be.visible');
        });
    });

    describe('UI - Sidebar Icon Display', () => {
        it('MM-EXT-CI014 Custom icon displays in sidebar', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(channelUrl);

            // # Open channel settings and set an icon
            cy.get('#channelHeaderDropdownButton').click();
            cy.findByText('Edit Channel').click();
            cy.get('.channel-settings-modal').should('be.visible');
            cy.findByRole('tab', {name: /icon/i}).click();

            // # Select an icon
            cy.get('.ChannelSettingsIconTab__libraryTab').contains('MDI').click();
            cy.get('.ChannelSettingsIconTab__search input').type('home');
            cy.get('.ChannelSettingsIconTab__iconButton').first().click();

            // # Save changes
            cy.get('.SaveChangesPanel button').contains('Save').click();

            // # Wait for save to complete
            cy.wait(1000);

            // # Close the modal
            cy.get('.close-x').click();

            // * Sidebar should show the custom icon for this channel
            cy.get(`#sidebarItem_${testChannel.name}`).within(() => {
                // The icon should be an SVG, not the default globe icon
                cy.get('svg').should('exist');
            });
        });
    });

    describe('Admin Dashboard - Custom Icons', () => {
        it('MM-EXT-CI015 Admin console shows Custom Channel Icons toggle', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended Features
            cy.get('.admin-sidebar').should('be.visible');
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Features').click();

            // * Custom Channel Icons toggle should exist
            cy.get('body').should('contain', 'Custom Channel Icons');
        });
    });

    describe('API - Icon Deletion', () => {
        it('MM-EXT-CI016 Admin can delete custom icon', () => {
            // # Skip if no icon was created
            if (!createdIconId) {
                cy.log('Skipping - no icon created');
                return;
            }

            // # Login as admin
            cy.apiAdminLogin();

            // # Delete the icon
            cy.request({
                url: `/api/v4/custom_channel_icons/${createdIconId}`,
                method: 'DELETE',
            }).then((response) => {
                expect(response.status).to.equal(200);
            });

            // * Icon should no longer exist
            cy.request({
                url: `/api/v4/custom_channel_icons/${createdIconId}`,
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(404);
            });

            // Clear the ID since it's deleted
            createdIconId = '';
        });
    });
});
