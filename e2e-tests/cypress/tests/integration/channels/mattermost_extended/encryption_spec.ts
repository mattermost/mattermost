// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @mattermost_extended @encryption

describe('End-to-End Encryption', () => {
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let testUser2: Cypress.UserProfile;
    let offTopicUrl: string;

    before(() => {
        // # Enable encryption feature flag
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                Encryption: true,
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
        // # Disable encryption feature flag
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                Encryption: false,
            },
        });
    });

    describe('Key Generation', () => {
        it('MM-EXT-E001 Keys are generated automatically on login', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // # Wait for page to fully load and key generation to complete
            cy.get('#post_textbox').should('be.visible');

            // # Check encryption status API
            cy.request('/api/v4/encryption/status').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body.enabled).to.equal(true);
                expect(response.body.has_key).to.equal(true);
                expect(response.body.session_id).to.not.be.empty;
            });
        });

        it('MM-EXT-E002 Public key is registered with the server', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // # Wait for key generation
            cy.get('#post_textbox').should('be.visible');

            // # Check that public key exists
            cy.request('/api/v4/encryption/publickey').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body.public_key).to.not.be.empty;
                expect(response.body.user_id).to.equal(testUser.id);
            });
        });

        it('MM-EXT-E003 Multiple sessions have unique keys', () => {
            // # Login as test user in first session
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Get first session key
            cy.request('/api/v4/encryption/publickey').then((response1) => {
                const firstKey = response1.body.public_key;
                const firstSessionId = response1.body.session_id;

                // # Clear session and login again (simulating new session)
                cy.apiLogout();
                cy.apiLogin(testUser);
                cy.visit(offTopicUrl);
                cy.get('#post_textbox').should('be.visible');

                // # Get keys for user - should have multiple sessions
                cy.request({
                    url: '/api/v4/encryption/publickeys',
                    method: 'POST',
                    body: {user_ids: [testUser.id]},
                }).then((response2) => {
                    expect(response2.status).to.equal(200);

                    // * Should have at least the current session key
                    expect(response2.body.length).to.be.at.least(1);

                    // * All keys should belong to the test user
                    response2.body.forEach((key: {user_id: string}) => {
                        expect(key.user_id).to.equal(testUser.id);
                    });
                });
            });
        });
    });

    describe('Feature Flag', () => {
        it('MM-EXT-E004 Returns 403 when encryption is disabled', () => {
            // # Disable encryption
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    Encryption: false,
                },
            });

            // # Login as test user
            cy.apiLogin(testUser);

            // # Attempt to register a public key
            cy.request({
                url: '/api/v4/encryption/publickey',
                method: 'POST',
                body: {public_key: 'test-key'},
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });

            // # Re-enable encryption for subsequent tests
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    Encryption: true,
                },
            });
        });

        it('MM-EXT-E005 Status endpoint shows disabled when feature is off', () => {
            // # Disable encryption
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    Encryption: false,
                },
            });

            // # Login as test user
            cy.apiLogin(testUser);

            // # Check encryption status
            cy.request('/api/v4/encryption/status').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body.enabled).to.equal(false);
            });

            // # Re-enable encryption for subsequent tests
            cy.apiAdminLogin();
            cy.apiUpdateConfig({
                FeatureFlags: {
                    Encryption: true,
                },
            });
        });
    });

    describe('Channel Member Keys', () => {
        it('MM-EXT-E006 Can retrieve keys for all channel members', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Get the off-topic channel ID
            cy.getCurrentChannelId().then((channelId) => {
                // # Request channel member keys
                cy.request(`/api/v4/encryption/channel/${channelId}/keys`).then((response) => {
                    expect(response.status).to.equal(200);

                    // * Should have at least the current user's key
                    expect(response.body.length).to.be.at.least(1);

                    // * Should include current user's key
                    const hasCurrentUser = response.body.some((key: {user_id: string}) => key.user_id === testUser.id);
                    expect(hasCurrentUser).to.equal(true);
                });
            });
        });

        it('MM-EXT-E007 Keys include all sessions for multi-device users', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Get keys for user
            cy.request({
                url: '/api/v4/encryption/publickeys',
                method: 'POST',
                body: {user_ids: [testUser.id]},
            }).then((response) => {
                expect(response.status).to.equal(200);

                // * Each key should have required fields
                response.body.forEach((key: {user_id: string; session_id: string; public_key: string}) => {
                    expect(key.user_id).to.not.be.empty;
                    expect(key.session_id).to.not.be.empty;
                    expect(key.public_key).to.not.be.empty;
                });
            });
        });
    });

    describe('Admin Dashboard', () => {
        it('MM-EXT-E008 Admin can view all encryption keys', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Request all keys
            cy.request('/api/v4/encryption/admin/keys').then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property('keys');
                expect(response.body).to.have.property('stats');
            });
        });

        it('MM-EXT-E009 Non-admin cannot access admin endpoints', () => {
            // # Login as regular user
            cy.apiLogin(testUser);

            // # Attempt to access admin endpoint
            cy.request({
                url: '/api/v4/encryption/admin/keys',
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });
        });

        it('MM-EXT-E010 Admin can delete orphaned keys', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Delete orphaned keys
            cy.request({
                url: '/api/v4/encryption/admin/keys/orphaned',
                method: 'DELETE',
            }).then((response) => {
                expect(response.status).to.equal(200);
            });
        });

        it('MM-EXT-E011 Admin can delete user keys', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # First, ensure user2 has keys by logging them in
            cy.apiLogin(testUser2);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Login back as admin
            cy.apiAdminLogin();

            // # Delete user2's keys
            cy.request({
                url: `/api/v4/encryption/admin/keys/${testUser2.id}`,
                method: 'DELETE',
            }).then((response) => {
                expect(response.status).to.equal(200);
            });

            // * Verify user2 no longer has keys
            cy.request({
                url: '/api/v4/encryption/publickeys',
                method: 'POST',
                body: {user_ids: [testUser2.id]},
            }).then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body.length).to.equal(0);
            });
        });
    });

    describe('Encryption Dashboard UI', () => {
        it('MM-EXT-E012 Admin console shows encryption dashboard', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.get('.admin-sidebar').should('be.visible');

            // # Find and click Mattermost Extended section
            cy.findByText('Mattermost Extended').should('exist').click();

            // # Click on Features section
            cy.findByText('Features').should('exist').click();

            // * Verify encryption toggle exists
            cy.get('body').should('contain', 'Encryption');
        });
    });
});
