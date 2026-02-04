// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @mattermost_extended @status

describe('Status Extended Features', () => {
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let testUser2: Cypress.UserProfile;
    let offTopicUrl: string;

    before(() => {
        // # Enable status features
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                AccurateStatuses: true,
                NoOffline: true,
            },
            MattermostExtendedSettings: {
                Statuses: {
                    EnableStatusLogs: true,
                    InactivityTimeoutMinutes: 5,
                    HeartbeatIntervalSeconds: 30,
                    StatusLogRetentionDays: 7,
                    DNDInactivityTimeoutMinutes: 30,
                },
            },
        });

        // # Create test team and users
        cy.apiInitSetup({loginAfter: false}).then(({team, user, offTopicUrl: url}) => {
            testTeam = team;
            testUser = user;
            offTopicUrl = url;

            // # Create second test user
            cy.apiCreateUser({prefix: 'user2'}).then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });
        });
    });

    after(() => {
        // # Disable status features
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                AccurateStatuses: false,
                NoOffline: false,
            },
            MattermostExtendedSettings: {
                Statuses: {
                    EnableStatusLogs: false,
                },
            },
        });
    });

    describe('AccurateStatuses', () => {
        it('MM-EXT-ST001 User status updates on page activity', () => {
            // # Login and visit channel
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Get current status
            cy.request(`/api/v4/users/${testUser.id}/status`).then((response) => {
                expect(response.status).to.equal(200);

                // * Status should be online after page load
                expect(response.body.status).to.equal('online');
            });
        });

        it('MM-EXT-ST002 Channel switch counts as activity', () => {
            // # Login and visit channel
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Navigate to another channel (Town Square)
            cy.get('#sidebarItem_town-square').click();
            cy.get('#post_textbox').should('be.visible');

            // * User should still be online
            cy.request(`/api/v4/users/${testUser.id}/status`).then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body.status).to.equal('online');
            });
        });

        it('MM-EXT-ST003 Sending message updates LastActivityAt', () => {
            // # Login and visit channel
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Get initial LastActivityAt
            cy.request(`/api/v4/users/${testUser.id}/status`).then((initialResponse) => {
                const initialLastActivity = initialResponse.body.last_activity_at;

                // # Wait a moment then send a message
                cy.wait(1000);
                cy.postMessage('Test message for activity tracking');

                // # Wait for message to be sent
                cy.get('.post-message__text').contains('Test message for activity tracking').should('be.visible');

                // # Check LastActivityAt was updated
                cy.request(`/api/v4/users/${testUser.id}/status`).then((response) => {
                    expect(response.body.last_activity_at).to.be.at.least(initialLastActivity);
                });
            });
        });

        it('MM-EXT-ST004 Manual status is preserved from heartbeat changes', () => {
            // # Login as test user
            cy.apiLogin(testUser);

            // # Set status to DND manually
            cy.request({
                url: `/api/v4/users/${testUser.id}/status`,
                method: 'PUT',
                body: {
                    user_id: testUser.id,
                    status: 'dnd',
                },
            }).then((response) => {
                expect(response.status).to.equal(200);
            });

            // # Visit channel (which triggers activity)
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Wait a moment for any heartbeat processing
            cy.wait(2000);

            // * Status should still be DND (manual status preserved)
            cy.request(`/api/v4/users/${testUser.id}/status`).then((response) => {
                expect(response.body.status).to.equal('dnd');
            });

            // # Reset status to online
            cy.request({
                url: `/api/v4/users/${testUser.id}/status`,
                method: 'PUT',
                body: {
                    user_id: testUser.id,
                    status: 'online',
                },
            });
        });
    });

    describe('NoOffline', () => {
        it('MM-EXT-ST005 Offline user becomes online on activity', () => {
            // # Login as admin to set user status
            cy.apiAdminLogin();

            // # Set test user to offline
            cy.request({
                url: `/api/v4/users/${testUser.id}/status`,
                method: 'PUT',
                body: {
                    user_id: testUser.id,
                    status: 'offline',
                },
            });

            // # Login as test user and visit channel
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Wait for NoOffline to process
            cy.wait(2000);

            // * User should now be online (NoOffline kicked in)
            cy.request(`/api/v4/users/${testUser.id}/status`).then((response) => {
                expect(response.body.status).to.equal('online');
            });
        });

        it('MM-EXT-ST006 Away user becomes online on activity', () => {
            // # Login as admin to set user status
            cy.apiAdminLogin();

            // # Set test user to away
            cy.request({
                url: `/api/v4/users/${testUser.id}/status`,
                method: 'PUT',
                body: {
                    user_id: testUser.id,
                    status: 'away',
                },
            });

            // # Login as test user and visit channel
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Wait for NoOffline to process
            cy.wait(2000);

            // * User should now be online
            cy.request(`/api/v4/users/${testUser.id}/status`).then((response) => {
                expect(response.body.status).to.equal('online');
            });
        });

        it('MM-EXT-ST007 DND status is NOT affected by NoOffline', () => {
            // # Login as test user
            cy.apiLogin(testUser);

            // # Set status to DND
            cy.request({
                url: `/api/v4/users/${testUser.id}/status`,
                method: 'PUT',
                body: {
                    user_id: testUser.id,
                    status: 'dnd',
                },
            });

            // # Visit channel
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Wait for any processing
            cy.wait(2000);

            // * DND should be preserved (not changed to online)
            cy.request(`/api/v4/users/${testUser.id}/status`).then((response) => {
                expect(response.body.status).to.equal('dnd');
            });

            // # Reset status
            cy.request({
                url: `/api/v4/users/${testUser.id}/status`,
                method: 'PUT',
                body: {
                    user_id: testUser.id,
                    status: 'online',
                },
            });
        });
    });

    describe('Status Log Dashboard', () => {
        it('MM-EXT-ST008 Admin can view status logs', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Get status logs
            cy.request('/api/v4/status_logs').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property('logs');
                expect(response.body).to.have.property('stats');
                expect(response.body).to.have.property('total_count');
            });
        });

        it('MM-EXT-ST009 Non-admin cannot view status logs', () => {
            // # Login as regular user
            cy.apiLogin(testUser);

            // # Attempt to get status logs
            cy.request({
                url: '/api/v4/status_logs',
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });
        });

        it('MM-EXT-ST010 Status logs can be filtered by user', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Get status logs filtered by user
            cy.request(`/api/v4/status_logs?user_id=${testUser.id}`).then((response) => {
                expect(response.status).to.equal(200);

                // * All logs should be for the specified user
                response.body.logs.forEach((log: {user_id: string}) => {
                    expect(log.user_id).to.equal(testUser.id);
                });
            });
        });

        it('MM-EXT-ST011 Status logs can be filtered by status', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Get status logs filtered by status
            cy.request('/api/v4/status_logs?status=online').then((response) => {
                expect(response.status).to.equal(200);

                // * All logs should have online as new_status
                response.body.logs.forEach((log: {new_status: string}) => {
                    expect(log.new_status).to.equal('online');
                });
            });
        });

        it('MM-EXT-ST012 Status logs can be filtered by log type', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Get status logs filtered by log type
            cy.request('/api/v4/status_logs?log_type=status_change').then((response) => {
                expect(response.status).to.equal(200);

                // * All logs should be status_change type
                response.body.logs.forEach((log: {log_type: string}) => {
                    expect(log.log_type).to.equal('status_change');
                });
            });
        });

        it('MM-EXT-ST013 Status logs support pagination', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Get first page
            cy.request('/api/v4/status_logs?page=0&per_page=10').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body.page).to.equal(0);
                expect(response.body.per_page).to.equal(10);
                expect(response.body.logs.length).to.be.at.most(10);
            });
        });

        it('MM-EXT-ST014 Admin can export status logs', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Export status logs
            cy.request('/api/v4/status_logs/export').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property('logs');
                expect(response.body).to.have.property('stats');
                expect(response.body).to.have.property('exported_at');
            });
        });

        it('MM-EXT-ST015 Admin can clear status logs', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Clear status logs
            cy.request({
                url: '/api/v4/status_logs',
                method: 'DELETE',
            }).then((response) => {
                expect(response.status).to.equal(200);
            });

            // * Logs should be cleared
            cy.request('/api/v4/status_logs').then((response) => {
                expect(response.body.total_count).to.equal(0);
            });
        });
    });

    describe('Status Log Dashboard UI', () => {
        it('MM-EXT-ST016 Admin console shows Status Log Dashboard', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.get('.admin-sidebar').should('be.visible');
            cy.findByText('Mattermost Extended').click();

            // * Status Logs link should exist
            cy.findByText('Status Logs').should('exist');
        });

        it('MM-EXT-ST017 Status Log Dashboard shows logs when enabled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Ensure logs are enabled
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        EnableStatusLogs: true,
                    },
                },
            });

            // # Navigate to Status Log Dashboard
            cy.visit('/admin_console');
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Status Logs').click();

            // * Dashboard content should be visible
            cy.get('.StatusLogDashboard').should('exist');
        });
    });

    describe('Feature Flag Configuration', () => {
        it('MM-EXT-ST018 Returns 403 when status logs disabled', () => {
            // # Disable status logs
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        EnableStatusLogs: false,
                    },
                },
            });

            // # Attempt to get status logs
            cy.request({
                url: '/api/v4/status_logs',
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });

            // # Re-enable for subsequent tests
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        EnableStatusLogs: true,
                    },
                },
            });
        });

        it('MM-EXT-ST019 Inactivity timeout is configurable', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Update inactivity timeout
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        InactivityTimeoutMinutes: 10,
                    },
                },
            });

            // # Verify config was updated
            cy.apiGetConfig().then(({config}) => {
                expect(config.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes).to.equal(10);
            });

            // # Reset to default
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        InactivityTimeoutMinutes: 5,
                    },
                },
            });
        });

        it('MM-EXT-ST020 DND timeout is configurable', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Update DND timeout
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        DNDInactivityTimeoutMinutes: 60,
                    },
                },
            });

            // # Verify config was updated
            cy.apiGetConfig().then(({config}) => {
                expect(config.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes).to.equal(60);
            });

            // # Reset to default
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Statuses: {
                        DNDInactivityTimeoutMinutes: 30,
                    },
                },
            });
        });
    });

    describe('Multi-User Status Visibility', () => {
        it('MM-EXT-ST021 User can see other users status changes', () => {
            // # Login as test user 2 and set their status
            cy.apiLogin(testUser2);
            cy.request({
                url: `/api/v4/users/${testUser2.id}/status`,
                method: 'PUT',
                body: {
                    user_id: testUser2.id,
                    status: 'away',
                },
            });

            // # Login as test user 1
            cy.apiLogin(testUser);

            // # Check user 2's status
            cy.request(`/api/v4/users/${testUser2.id}/status`).then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body.status).to.equal('away');
            });

            // # Update user 2's status
            cy.apiLogin(testUser2);
            cy.request({
                url: `/api/v4/users/${testUser2.id}/status`,
                method: 'PUT',
                body: {
                    user_id: testUser2.id,
                    status: 'online',
                },
            });

            // # Check from user 1's perspective
            cy.apiLogin(testUser);
            cy.request(`/api/v4/users/${testUser2.id}/status`).then((response) => {
                expect(response.body.status).to.equal('online');
            });
        });

        it('MM-EXT-ST022 Bulk status check works', () => {
            // # Login as test user
            cy.apiLogin(testUser);

            // # Request multiple user statuses
            cy.request({
                url: '/api/v4/users/status/ids',
                method: 'POST',
                body: [testUser.id, testUser2.id],
            }).then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body).to.be.an('array');
                expect(response.body.length).to.equal(2);

                // * Both users should have status info
                const user1Status = response.body.find((s: {user_id: string}) => s.user_id === testUser.id);
                const user2Status = response.body.find((s: {user_id: string}) => s.user_id === testUser2.id);
                expect(user1Status).to.exist;
                expect(user2Status).to.exist;
            });
        });
    });
});
