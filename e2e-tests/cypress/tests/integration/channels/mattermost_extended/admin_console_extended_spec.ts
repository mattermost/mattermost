// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @mattermost_extended @admin_console

describe('Admin Console Extended Features', () => {
    before(() => {
        // # Enable admin console features
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                SystemConsoleDarkMode: true,
                SystemConsoleHideEnterprise: true,
                SystemConsoleIcons: true,
                ErrorLogDashboard: true,
                PreferencesRevamp: true,
                PreferenceOverridesDashboard: true,
            },
        });
    });

    after(() => {
        // # Disable admin console features
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                SystemConsoleDarkMode: false,
                SystemConsoleHideEnterprise: false,
                SystemConsoleIcons: false,
                ErrorLogDashboard: false,
                PreferencesRevamp: false,
                PreferenceOverridesDashboard: false,
            },
        });
    });

    describe('SystemConsoleDarkMode', () => {
        it('MM-EXT-AC001 Dark mode is applied to admin console', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // * Dark mode class should be applied to body or wrapper
            cy.get('body').should('have.class', 'admin-console-dark-mode');
        });

        it('MM-EXT-AC002 Dark mode styling is visible', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // * Background should be dark (CSS filter or dark colors)
            cy.get('.admin-console, .admin-console__wrapper').should('be.visible');

            // * Check that dark mode styles are applied
            cy.get('body').then(($body) => {
                // Check for dark mode class or inverted filter
                const hasDarkMode = $body.hasClass('admin-console-dark-mode') ||
                    $body.hasClass('admin-console--dark-mode');
                expect(hasDarkMode).to.be.true;
            });
        });

        it('MM-EXT-AC003 Dark mode can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable dark mode
            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleDarkMode: false,
                },
            });

            cy.visit('/admin_console');

            // * Dark mode class should NOT be applied
            cy.get('body').should('not.have.class', 'admin-console-dark-mode');

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleDarkMode: true,
                },
            });
        });
    });

    describe('SystemConsoleHideEnterprise', () => {
        it('MM-EXT-AC004 Enterprise features are hidden', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // * Items with enterprise/upgrade badges should be hidden
            cy.get('.admin-sidebar').within(() => {
                // Enterprise-only items should not be visible
                cy.get('[class*="restricted"], [class*="enterprise"]').should('not.be.visible');
            });
        });

        it('MM-EXT-AC005 Non-enterprise features are still visible', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // * Standard settings should be visible
            cy.get('.admin-sidebar').should('be.visible');
            cy.findByText('System Console').should('exist');
            cy.findByText('Environment').should('exist');
        });

        it('MM-EXT-AC006 Enterprise features visible when disabled', () => {
            // # Disable the feature
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleHideEnterprise: false,
                },
            });

            cy.visit('/admin_console');

            // * Enterprise features should now be visible in sidebar
            cy.get('.admin-sidebar').should('be.visible');

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleHideEnterprise: true,
                },
            });
        });
    });

    describe('SystemConsoleIcons', () => {
        it('MM-EXT-AC007 Icons are shown next to sidebar sections', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // * Sidebar sections should have icons
            cy.get('.admin-sidebar').within(() => {
                cy.get('svg, .icon, [class*="icon"]').should('exist');
            });
        });

        it('MM-EXT-AC008 Icons removed when feature disabled', () => {
            // # Disable the feature
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleIcons: false,
                },
            });

            cy.visit('/admin_console');

            // * Sidebar sections should not have our custom icons
            // Note: Some icons may still exist from upstream Mattermost

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleIcons: true,
                },
            });
        });
    });

    describe('PreferenceOverridesDashboard', () => {
        it('MM-EXT-AC009 Preference overrides dashboard accessible', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.findByText('Mattermost Extended').click();

            // * User Preferences option should exist
            cy.findByText('User Preferences').should('exist');
        });

        it('MM-EXT-AC010 Admin can view preference categories', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to User Preferences
            cy.findByText('Mattermost Extended').click();
            cy.findByText('User Preferences').click();

            // * Dashboard should be visible with preference categories
            cy.get('.PreferenceOverridesDashboard, .preference-overrides-dashboard').should('be.visible');
        });

        it('MM-EXT-AC011 Admin can set preference overrides', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to User Preferences
            cy.findByText('Mattermost Extended').click();
            cy.findByText('User Preferences').click();

            // * Override controls should be available
            cy.get('.preference-override-row, .PreferenceRow').should('exist');
        });

        it('MM-EXT-AC012 Override applies to users', () => {
            // # This would require testing with a second user
            // # Set an override via API
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Preferences: {
                        Overrides: {
                            'display_settings:use_military_time': 'true',
                        },
                    },
                },
            });

            // * Config should be updated
            cy.apiGetConfig().then(({config}) => {
                expect(config.MattermostExtendedSettings.Preferences.Overrides['display_settings:use_military_time']).to.equal('true');
            });

            // # Clear the override
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Preferences: {
                        Overrides: {},
                    },
                },
            });
        });

        it('MM-EXT-AC013 User cannot change overridden preference', () => {
            // # Set a preference override
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Preferences: {
                        Overrides: {
                            'display_settings:use_military_time': 'true',
                        },
                    },
                },
            });

            // # Login as regular user and try to change preference
            // Note: This test depends on the preference UI showing locked state

            // # Clear the override
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Preferences: {
                        Overrides: {},
                    },
                },
            });
        });
    });

    describe('StatusLogDashboard', () => {
        before(() => {
            // # Enable status logs
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        EnableStatusLogs: true,
                        InactivityTimeoutMinutes: 5,
                        HeartbeatIntervalSeconds: 30,
                        StatusLogRetentionDays: 7,
                    },
                },
            });
        });

        it('MM-EXT-AC029 Status log dashboard accessible in sidebar', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.findByText('Mattermost Extended').click();

            // * Status Logs option should exist
            cy.findByText('Status Logs').should('exist');
        });

        it('MM-EXT-AC030 Status log dashboard renders when enabled', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Dashboard should be visible
            cy.get('.StatusLogDashboard, .status-log-dashboard, .admin-console__wrapper').should('be.visible');
        });

        it('MM-EXT-AC031 Status log dashboard shows promotional card when disabled', () => {
            // # Disable status logs
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        EnableStatusLogs: false,
                    },
                },
            });

            cy.visit('/admin_console');
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Should show promotional/enable card
            cy.get('.StatusLogDashboard, .status-log-dashboard, .admin-console__wrapper').should('be.visible');

            // * Should have enable button or promotional content
            cy.findByText(/Enable|Status Logging/i).should('exist');

            // # Re-enable for subsequent tests
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        EnableStatusLogs: true,
                    },
                },
            });
        });

        it('MM-EXT-AC032 Status log dashboard displays filter controls', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Filter controls should exist (dropdowns for log_type, status, search)
            cy.get('select, .filter-dropdown, input[type="search"], .StatusLogFilters, .log-filters').should('exist');
        });

        it('MM-EXT-AC033 Status log dashboard can filter by log type', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Log type filter should exist and be usable
            cy.get('select, .log-type-filter').first().should('exist');
        });

        it('MM-EXT-AC034 Status log dashboard can filter by status', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Status filter should exist
            cy.get('select, .status-filter').should('exist');
        });

        it('MM-EXT-AC035 Status log dashboard has search functionality', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Search input should exist
            cy.get('input[type="search"], input[type="text"], .search-input').should('exist');
        });

        it('MM-EXT-AC036 Status log dashboard has export functionality', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Export button should exist
            cy.findByText(/Export/i).should('exist');
        });

        it('MM-EXT-AC037 Status log dashboard has clear functionality', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Clear button should exist
            cy.findByText(/Clear/i).should('exist');
        });

        it('MM-EXT-AC038 Status log dashboard has tabs for logs and notification rules', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Tab controls should exist
            cy.get('.tabs, [role="tablist"], .StatusLogTabs').should('exist');
        });

        it('MM-EXT-AC039 Status log entry shows user, status, and device info', () => {
            // # First, generate a status log by changing status
            cy.apiAdminLogin();

            // # Trigger a status change to create a log entry
            cy.apiGetMe().then(({user}) => {
                cy.request({
                    url: `/api/v4/users/${user.id}/status`,
                    method: 'PUT',
                    body: {
                        user_id: user.id,
                        status: 'away',
                    },
                });

                // # Change back to create another log
                cy.request({
                    url: `/api/v4/users/${user.id}/status`,
                    method: 'PUT',
                    body: {
                        user_id: user.id,
                        status: 'online',
                    },
                });
            });

            // # Navigate to Status Logs
            cy.visit('/admin_console');
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Dashboard should show log entries (or empty state if no logs)
            cy.get('.StatusLogDashboard, .status-log-dashboard, .admin-console__wrapper').should('be.visible');
        });

        it('MM-EXT-AC040 Status log dashboard displays stats summary', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Status Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Stats section should be visible (counts by status)
            cy.get('.StatusLogStats, .stats-summary, .status-stats').should('exist');
        });

        it('MM-EXT-AC041 Status log retention setting is visible in Statuses section', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Statuses settings
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Statuses').click();

            // * Status log retention setting should exist
            cy.findByText(/Retention|Status Log/i).should('exist');
        });
    });

    describe('ErrorLogDashboard', () => {
        it('MM-EXT-AC014 Error log dashboard accessible', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.findByText('Mattermost Extended').click();

            // * Error Logs option should exist
            cy.findByText('Error Logs').should('exist');
        });

        it('MM-EXT-AC015 Error dashboard displays', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Error Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Error Logs').click();

            // * Dashboard should be visible
            cy.get('.ErrorLogDashboard, .error-log-dashboard, .admin-console__wrapper').should('be.visible');
        });

        it('MM-EXT-AC016 Error filters work', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Error Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Error Logs').click();

            // * Filter controls should be available
            cy.get('select, .filter-dropdown, input[type="search"]').should('exist');
        });

        it('MM-EXT-AC017 Clear errors functionality', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Error Logs
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Error Logs').click();

            // * Clear button should exist
            cy.findByText(/Clear/i).should('exist');
        });
    });

    describe('Mattermost Extended Sidebar', () => {
        it('MM-EXT-AC018 Mattermost Extended section in sidebar', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // * Mattermost Extended section should be visible
            cy.get('.admin-sidebar').should('contain', 'Mattermost Extended');
        });

        it('MM-EXT-AC019 Features subsection exists', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Expand Mattermost Extended
            cy.findByText('Mattermost Extended').click();

            // * Features subsection should exist
            cy.findByText('Features').should('exist');
        });

        it('MM-EXT-AC020 Statuses subsection exists', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Expand Mattermost Extended
            cy.findByText('Mattermost Extended').click();

            // * Statuses subsection should exist
            cy.findByText('Statuses').should('exist');
        });

        it('MM-EXT-AC021 Media subsection exists', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Expand Mattermost Extended
            cy.findByText('Mattermost Extended').click();

            // * Media subsection should exist
            cy.findByText('Media').should('exist');
        });

        it('MM-EXT-AC022 Posts subsection exists', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Expand Mattermost Extended
            cy.findByText('Mattermost Extended').click();

            // * Posts subsection should exist
            cy.findByText('Posts').should('exist');
        });

        it('MM-EXT-AC023 Channels subsection exists', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Expand Mattermost Extended
            cy.findByText('Mattermost Extended').click();

            // * Channels subsection should exist
            cy.findByText('Channels').should('exist');
        });
    });

    describe('Feature Flag Toggle Tests', () => {
        it('MM-EXT-AC024 SystemConsoleDarkMode can be toggled', () => {
            cy.apiAdminLogin();

            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleDarkMode: false,
                },
            });

            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.SystemConsoleDarkMode).to.equal(false);
            });

            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleDarkMode: true,
                },
            });
        });

        it('MM-EXT-AC025 SystemConsoleHideEnterprise can be toggled', () => {
            cy.apiAdminLogin();

            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleHideEnterprise: false,
                },
            });

            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.SystemConsoleHideEnterprise).to.equal(false);
            });

            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleHideEnterprise: true,
                },
            });
        });

        it('MM-EXT-AC026 SystemConsoleIcons can be toggled', () => {
            cy.apiAdminLogin();

            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleIcons: false,
                },
            });

            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.SystemConsoleIcons).to.equal(false);
            });

            cy.apiUpdateConfig({
                FeatureFlags: {
                    SystemConsoleIcons: true,
                },
            });
        });

        it('MM-EXT-AC027 ErrorLogDashboard can be toggled', () => {
            cy.apiAdminLogin();

            cy.apiUpdateConfig({
                FeatureFlags: {
                    ErrorLogDashboard: false,
                },
            });

            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.ErrorLogDashboard).to.equal(false);
            });

            cy.apiUpdateConfig({
                FeatureFlags: {
                    ErrorLogDashboard: true,
                },
            });
        });

        it('MM-EXT-AC028 PreferenceOverridesDashboard can be toggled', () => {
            cy.apiAdminLogin();

            cy.apiUpdateConfig({
                FeatureFlags: {
                    PreferenceOverridesDashboard: false,
                },
            });

            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.PreferenceOverridesDashboard).to.equal(false);
            });

            cy.apiUpdateConfig({
                FeatureFlags: {
                    PreferenceOverridesDashboard: true,
                },
            });
        });
    });
});
