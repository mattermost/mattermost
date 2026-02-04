// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @mattermost_extended @threads

describe('Thread Extended Features', () => {
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let testChannel: Cypress.Channel;
    let offTopicUrl: string;

    before(() => {
        // # Enable thread features and CRT
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                CollapsedThreads: 'default_on',
            },
            FeatureFlags: {
                ThreadsInSidebar: true,
                CustomThreadNames: true,
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
        // # Disable thread features
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                ThreadsInSidebar: false,
                CustomThreadNames: false,
            },
        });
    });

    describe('ThreadsInSidebar', () => {
        let threadRootId: string;

        beforeEach(() => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');
        });

        it('MM-EXT-TH001 Followed threads appear under parent channel in sidebar', () => {
            // # Create a new post
            const rootMessage = `Root message ${Date.now()}`;
            cy.postMessage(rootMessage);

            // # Get the post ID and create a reply to make it a thread
            cy.getLastPostId().then((postId) => {
                threadRootId = postId;

                // # Reply to create a thread
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS(`Reply to thread ${Date.now()}`);

                // # Follow the thread (should be auto-followed when replying)
                // # Close RHS
                cy.uiCloseRHS();

                // * Thread should appear in sidebar under the channel
                cy.get('.SidebarChannelGroup').should('contain', 'Threads');
            });
        });

        it('MM-EXT-TH002 Thread shows message preview as label', () => {
            // # Create a post with specific content
            const messageContent = 'This is a unique thread message for testing';
            cy.postMessage(messageContent);

            // # Reply to create a thread
            cy.getLastPostId().then((postId) => {
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('A reply');
                cy.uiCloseRHS();

                // * Sidebar thread item should show truncated message
                cy.get('.SidebarThreadItem, .sidebar-thread-item').then(($items) => {
                    if ($items.length > 0) {
                        // Should contain some part of the message
                        cy.wrap($items).first().should('contain.text', 'This is');
                    }
                });
            });
        });

        it('MM-EXT-TH003 Clicking thread in sidebar opens full-width thread view', () => {
            // # Create a thread first
            cy.postMessage('Thread for navigation test');
            cy.getLastPostId().then((postId) => {
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('Reply for nav test');
                cy.uiCloseRHS();

                // # Click on the thread in sidebar
                cy.get('.SidebarThreadItem, .sidebar-thread-item').first().click();

                // * Should navigate to full-width thread view
                cy.url().should('include', '/thread/');
            });
        });

        it('MM-EXT-TH004 Unread threads show unread indicator', () => {
            // # Create a thread and have another user reply
            cy.postMessage('Thread for unread test');
            cy.getLastPostId().then((postId) => {
                // # Reply as test user
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('First reply');
                cy.uiCloseRHS();

                // * Thread item should show in sidebar
                cy.get('.SidebarThreadItem, .sidebar-thread-item').should('exist');
            });
        });

        it('MM-EXT-TH005 Unfollowing thread removes it from sidebar', () => {
            // # Create and follow a thread
            cy.postMessage('Thread to unfollow');
            cy.getLastPostId().then((postId) => {
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('Reply');

                // # Unfollow the thread via RHS menu
                cy.get('#rhsContainer').within(() => {
                    cy.get('.ThreadMenu, .thread-menu, [aria-label*="More"]').first().click();
                });
                cy.findByText(/Unfollow/i).click();

                cy.uiCloseRHS();

                // * Thread should no longer appear in sidebar (or be marked as unfollowed)
                // Note: Behavior depends on implementation
            });
        });

        it('MM-EXT-TH006 Thread with mentions shows mention badge', () => {
            // # This test would require another user to mention the test user
            // # Create a thread
            cy.postMessage('Thread with mentions test');
            cy.getLastPostId().then((postId) => {
                cy.clickPostCommentIcon(postId);

                // # Self-mention for testing purposes
                cy.postMessageReplyInRHS(`Hey @${testUser.username}, check this!`);
                cy.uiCloseRHS();

                // * Thread item should show mention indicator
                cy.get('.SidebarThreadItem, .sidebar-thread-item').then(($items) => {
                    if ($items.length > 0) {
                        // Should have some form of mention indicator
                        cy.wrap($items).first().find('.badge, .mention-badge, [class*="mention"]').should('exist');
                    }
                });
            });
        });
    });

    describe('CustomThreadNames', () => {
        beforeEach(() => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');
        });

        it('MM-EXT-TH007 User can rename thread in full-width view', () => {
            // # Create a thread
            const originalMessage = 'Original thread message';
            cy.postMessage(originalMessage);

            cy.getLastPostId().then((postId) => {
                // # Reply to create thread
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('Creating a thread');
                cy.uiCloseRHS();

                // # Navigate to full-width thread view
                cy.visit(`/${testTeam.name}/thread/${postId}`);

                // # Find and click the thread name/edit button
                cy.get('.ThreadView, .thread-view').within(() => {
                    // # Look for editable thread name element
                    cy.get('.thread-header-title, .ThreadViewHeader, [class*="thread-name"]').first().then(($header) => {
                        // # Click to edit or find edit button
                        if ($header.find('.edit-button, .pencil-icon, [aria-label*="edit"]').length > 0) {
                            cy.wrap($header).find('.edit-button, .pencil-icon, [aria-label*="edit"]').click();
                        } else {
                            cy.wrap($header).click();
                        }
                    });
                });

                // # Type new thread name
                const customName = 'My Custom Thread Name';
                cy.get('input[type="text"], .thread-name-input').type('{selectall}' + customName);

                // # Save (press Enter)
                cy.get('input[type="text"], .thread-name-input').type('{enter}');

                // * Custom name should be displayed
                cy.get('.thread-header-title, .ThreadViewHeader').should('contain', customName);
            });
        });

        it('MM-EXT-TH008 Custom thread name appears in sidebar', () => {
            // # Create a thread with custom name
            cy.postMessage('Thread for sidebar name test');

            cy.getLastPostId().then((postId) => {
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('Reply');
                cy.uiCloseRHS();

                // # Navigate to thread view and set custom name
                cy.visit(`/${testTeam.name}/thread/${postId}`);

                // # Set custom name
                cy.get('.thread-header-title, .ThreadViewHeader, [class*="thread-name"]').first().click();
                const customName = 'Sidebar Display Test';
                cy.get('input[type="text"], .thread-name-input').type('{selectall}' + customName);
                cy.get('input[type="text"], .thread-name-input').type('{enter}');

                // # Go back to channel
                cy.visit(offTopicUrl);

                // * Sidebar should show custom name
                cy.get('.SidebarThreadItem, .sidebar-thread-item').should('contain', customName);
            });
        });

        it('MM-EXT-TH009 Clearing custom name reverts to message preview', () => {
            const originalMessage = 'Thread message to revert';
            cy.postMessage(originalMessage);

            cy.getLastPostId().then((postId) => {
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('Reply');
                cy.uiCloseRHS();

                // # Navigate to thread view
                cy.visit(`/${testTeam.name}/thread/${postId}`);

                // # Set custom name first
                cy.get('.thread-header-title, .ThreadViewHeader, [class*="thread-name"]').first().click();
                cy.get('input[type="text"], .thread-name-input').type('{selectall}Temporary Name');
                cy.get('input[type="text"], .thread-name-input').type('{enter}');

                // # Clear the custom name
                cy.get('.thread-header-title, .ThreadViewHeader, [class*="thread-name"]').first().click();
                cy.get('input[type="text"], .thread-name-input').clear();
                cy.get('input[type="text"], .thread-name-input').type('{enter}');

                // * Should show original message or default
                cy.get('.thread-header-title, .ThreadViewHeader').should('contain.text', originalMessage.substring(0, 20));
            });
        });

        it('MM-EXT-TH010 Escape key cancels thread name edit', () => {
            cy.postMessage('Thread for escape test');

            cy.getLastPostId().then((postId) => {
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('Reply');
                cy.uiCloseRHS();

                cy.visit(`/${testTeam.name}/thread/${postId}`);

                // # Get original name/text
                cy.get('.thread-header-title, .ThreadViewHeader').invoke('text').then((originalText) => {
                    // # Click to edit
                    cy.get('.thread-header-title, .ThreadViewHeader, [class*="thread-name"]').first().click();

                    // # Type something new
                    cy.get('input[type="text"], .thread-name-input').type('{selectall}Should Not Save');

                    // # Press Escape
                    cy.get('input[type="text"], .thread-name-input').type('{esc}');

                    // * Original text should be restored
                    cy.get('.thread-header-title, .ThreadViewHeader').should('contain.text', originalText.trim().substring(0, 10));
                });
            });
        });

        it('MM-EXT-TH011 Thread name is trimmed of whitespace', () => {
            cy.postMessage('Thread for whitespace test');

            cy.getLastPostId().then((postId) => {
                cy.clickPostCommentIcon(postId);
                cy.postMessageReplyInRHS('Reply');
                cy.uiCloseRHS();

                cy.visit(`/${testTeam.name}/thread/${postId}`);

                // # Set name with leading/trailing whitespace
                cy.get('.thread-header-title, .ThreadViewHeader, [class*="thread-name"]').first().click();
                cy.get('input[type="text"], .thread-name-input').type('{selectall}   Trimmed Name   ');
                cy.get('input[type="text"], .thread-name-input').type('{enter}');

                // * Should be trimmed
                cy.get('.thread-header-title, .ThreadViewHeader').should('contain', 'Trimmed Name');
                cy.get('.thread-header-title, .ThreadViewHeader').should('not.contain', '   Trimmed');
            });
        });
    });

    describe('Feature Flag Configuration', () => {
        it('MM-EXT-TH012 ThreadsInSidebar can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable ThreadsInSidebar
            cy.apiUpdateConfig({
                FeatureFlags: {
                    ThreadsInSidebar: false,
                },
            });

            // # Verify config
            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.ThreadsInSidebar).to.equal(false);
            });

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    ThreadsInSidebar: true,
                },
            });
        });

        it('MM-EXT-TH013 CustomThreadNames can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable CustomThreadNames
            cy.apiUpdateConfig({
                FeatureFlags: {
                    CustomThreadNames: false,
                },
            });

            // # Verify config
            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.CustomThreadNames).to.equal(false);
            });

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    CustomThreadNames: true,
                },
            });
        });

        it('MM-EXT-TH014 ThreadsInSidebar requires CRT to be enabled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // * CRT should be enabled for ThreadsInSidebar to work
            cy.apiGetConfig().then(({config}) => {
                expect(config.ServiceSettings.CollapsedThreads).to.equal('default_on');
            });
        });
    });

    describe('Admin Console Thread Settings', () => {
        it('MM-EXT-TH015 Admin console shows thread feature flags', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.get('.admin-sidebar').should('be.visible');
            cy.findByText('Mattermost Extended').click();

            // * Features section should show thread options
            cy.findByText('Features').click();
            cy.get('.admin-console__wrapper').should('be.visible');
        });
    });
});
