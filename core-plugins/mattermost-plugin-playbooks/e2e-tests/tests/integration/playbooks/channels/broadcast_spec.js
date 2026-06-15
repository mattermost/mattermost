// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > broadcast', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testAdmin;
    let testPublicChannel1;
    let testPublicChannel2;
    let testPrivateChannel1;
    let testPrivateChannel2;
    let publicBroadcastPlaybook;
    let privateBroadcastPlaybook;
    let allBroadcastPlaybook;
    let rootDeletePlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin: adminUser}) => {
                testAdmin = adminUser;
                cy.apiAddUserToTeam(testTeam.id, adminUser.id);
                cy.apiSaveJoinLeaveMessagesPreference(adminUser.id, false);

                // # Login as testUser
                cy.apiLogin(testUser);

                // # Create a public channel
                cy.apiCreateChannel(
                    testTeam.id,
                    'public-channel',
                    'Public Channel 1',
                    'O',
                ).then(({channel: publicChannel1}) => {
                    testPublicChannel1 = publicChannel1;

                    // # Create a public channel
                    cy.apiCreateChannel(
                        testTeam.id,
                        'public-channel',
                        'Public Channel 2',
                        'O',
                    ).then(({channel: publicChannel2}) => {
                        testPublicChannel2 = publicChannel2;

                        // # Create a private channel
                        cy.apiCreateChannel(
                            testTeam.id,
                            'private-channel',
                            'Private Channel 1',
                            'P',
                        ).then(({channel: privateChannel1}) => {
                            testPrivateChannel1 = privateChannel1;

                            // # Create a private channel
                            cy.apiCreateChannel(
                                testTeam.id,
                                'private-channel',
                                'Private Channel 2',
                                'P',
                            ).then(({channel: privateChannel2}) => {
                                testPrivateChannel2 = privateChannel2;

                                // # Create a playbook that will broadcast to public channel1
                                cy.apiCreateTestPlaybook({
                                    teamId: testTeam.id,
                                    title: 'Playbook - public broadcast',
                                    userId: testUser.id,
                                    broadcastChannelIds: [testPublicChannel1.id],
                                    broadcastEnabled: true,
                                }).then((playbook) => {
                                    publicBroadcastPlaybook = playbook;
                                });

                                // # Create a playbook that will broadcast to private channel1
                                cy.apiCreateTestPlaybook({
                                    teamId: testTeam.id,
                                    title: 'Playbook - private broadcast',
                                    userId: testUser.id,
                                    broadcastChannelIds: [testPrivateChannel1.id],
                                    broadcastEnabled: true,
                                }).then((playbook) => {
                                    privateBroadcastPlaybook = playbook;
                                });

                                // # Create a playbook that will broadcast to all 4 channels
                                cy.apiCreateTestPlaybook({
                                    teamId: testTeam.id,
                                    title: 'Playbook - public and private broadcast',
                                    userId: testUser.id,
                                    broadcastChannelIds: [testPublicChannel1.id, testPublicChannel2.id, testPrivateChannel1.id, testPrivateChannel2.id],
                                    broadcastEnabled: true,
                                }).then((playbook) => {
                                    allBroadcastPlaybook = playbook;
                                });

                                // # Create a playbook for testing deleting root posts
                                cy.apiCreateTestPlaybook({
                                    teamId: testTeam.id,
                                    title: 'Playbook - test deleting root posts',
                                    userId: testUser.id,
                                    broadcastChannelIds: [testPublicChannel1.id, testPrivateChannel1.id],
                                    broadcastEnabled: true,
                                    otherMembers: [testAdmin.id],
                                    invitedUserIds: [testAdmin.id],
                                }).then((playbook) => {
                                    rootDeletePlaybook = playbook;
                                });

                                // # invite testAdmin to the channel they will need to be in to delete the post
                                cy.apiAddUserToChannel(testPublicChannel1.id, testAdmin.id);
                                cy.apiAddUserToChannel(testPrivateChannel1.id, testAdmin.id);
                            });
                        });
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Go to Town Square
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('to public channels', () => {
        // # Create a new playbook run
        const now = Date.now();
        const playbookRunName = `Playbook Run (${now})`;
        const playbookRunChannelName = `playbook-run-${now}`;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: publicBroadcastPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

        // # Update the playbook run's status
        const updateMessage = 'Update - ' + now;
        cy.updateStatus(updateMessage);

        // * Verify the posts
        const initialMessage = playbookRunName;
        verifyInitialAndStatusPostInBroadcast(testTeam, testPublicChannel1.name, playbookRunName, initialMessage, updateMessage);
    });

    it('does not broadcast when broadcast is disabled, even if broadcastChannelIds contain data', () => {
        // # Create a brand new channel
        cy.apiCreateChannel(
            testTeam.id,
            'public-channel-do-not-broadcast',
            'Public Channel 1 - do not broadcast',
            'O',
        ).then(({channel}) => {
            // # Create a playbook with broadcast disabled, but with broadcastChannelIds containing channel1
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook - disabled public broadcast',
                userId: testUser.id,
                broadcastChannelIds: [channel.id],
                broadcastEnabled: false,
            }).then((playbook) => {
                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Playbook Run (${now})`;
                const playbookRunChannelName = `playbook-run-${now}`;
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName,
                    ownerUserId: testUser.id,
                });

                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // # Update the playbook run's status
                const updateMessage = 'Update - ' + now;
                cy.updateStatus(updateMessage);

                // # Navigate to the broadcast channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // * Verify that the last post is the system post containing the join message,
                // so no announcement nor update was posted
                cy.getLastPostId().then((lastPostId) => {
                    cy.get(`#postMessageText_${lastPostId}`).contains('You joined the channel');
                });
            });
        });
    });

    it('to private channels', () => {
        // # Create a new playbook run
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        const playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: privateBroadcastPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

        // # Update the playbook run's status
        const updateMessage = 'Update - ' + now;
        cy.updateStatus(updateMessage);

        // * Verify the posts
        const initialMessage = playbookRunName;
        verifyInitialAndStatusPostInBroadcast(testTeam, testPrivateChannel1.name, playbookRunName, initialMessage, updateMessage);
    });

    it('to 4 public and private channels', () => {
        // # Create a new playbook run
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        const playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: allBroadcastPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

        // # Update the playbook run's status
        const updateMessage = 'Update - ' + now;
        cy.updateStatus(updateMessage, 0);

        // * Verify the posts
        const initialMessage = playbookRunName;
        verifyInitialAndStatusPostInBroadcast(testTeam, testPublicChannel1.name, playbookRunName, initialMessage, updateMessage);
        verifyInitialAndStatusPostInBroadcast(testTeam, testPrivateChannel1.name, playbookRunName, initialMessage, updateMessage);
        verifyInitialAndStatusPostInBroadcast(testTeam, testPublicChannel2.name, playbookRunName, initialMessage, updateMessage);
        verifyInitialAndStatusPostInBroadcast(testTeam, testPrivateChannel2.name, playbookRunName, initialMessage, updateMessage);
    });

    it('to 2 channels, delete the root post, update again', () => {
        // # Create a new playbook run
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        const playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: rootDeletePlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

        // # Update the playbook run's status
        const updateMessage = 'Update - ' + now;
        cy.updateStatus(updateMessage, 0);

        // * Verify the posts
        const initialMessage = playbookRunName;
        verifyInitialAndStatusPostInBroadcast(testTeam, testPublicChannel1.name, playbookRunName, initialMessage, updateMessage);
        verifyInitialAndStatusPostInBroadcast(testTeam, testPrivateChannel1.name, playbookRunName, initialMessage, updateMessage);

        // # need to be admin to delete the bot's posts
        cy.apiLogin(testAdmin);

        // # Delete both root posts
        deleteLatestPostRoot(testTeam, testPublicChannel1.name);
        deleteLatestPostRoot(testTeam, testPrivateChannel1.name);

        // # Log back in as testUser
        cy.apiLogin(testUser);

        // # Make two more updates
        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

        // # Update the playbook run's status twice
        const updateMessage2 = updateMessage + ' - 2';
        cy.updateStatus(updateMessage2, 0);
        const updateMessage3 = updateMessage + ' - 3';
        cy.updateStatus(updateMessage3, 0);

        // * Verify the posts
        verifyInitialAndStatusPostInBroadcast(testTeam, testPublicChannel1.name, playbookRunName, updateMessage2, updateMessage3);
        verifyInitialAndStatusPostInBroadcast(testTeam, testPrivateChannel1.name, playbookRunName, updateMessage2, updateMessage3);
    });
});

const verifyInitialAndStatusPostInBroadcast = (testTeam, channelName, runName, initialMessage, updateMessage) => {
    cy.log(`Verifying initial and status post in broadcast (channel ${channelName}, run ${runName})`);

    // # Navigate to the broadcast channel
    cy.visit(`/${testTeam.name}/channels/${channelName}`);

    // * Verify that the last post contains the expected header and the update message verbatim
    cy.getLastPostId().then((lastPostId) => {
        // # Open RHS comment menu
        cy.clickPostCommentIcon(lastPostId);

        cy.get('#rhsContainer').
            should('exist').
            within(() => {
                // * Thread should have two posts
                cy.findAllByTestId('postContent').should('have.length', 2);

                // * The first should be announcement
                cy.findAllByTestId('postContent').eq(0).contains(initialMessage);

                // * Latest post should be update
                cy.get(`#rhsPost_${lastPostId}`).contains(
                    `posted an update for ${runName}`,
                );
                cy.get(`#rhsPost_${lastPostId}`).contains('tasks checked');
                cy.get(`#rhsPost_${lastPostId}`).contains('participant');
                cy.get(`#rhsPost_${lastPostId}`).contains(updateMessage);
            });
    });
};

const deleteLatestPostRoot = (testTeam, channelName) => {
    cy.log(`Deleting latest root post (channel ${channelName})`);

    // # Navigate to the channel
    cy.visit(`/${testTeam.name}/channels/${channelName}`);

    cy.getLastPostId().then((lastPostId) => {
        // # Open RHS comment menu
        cy.clickPostCommentIcon(lastPostId);

        cy.get('#rhsContainer').
            should('exist').
            within(() => {
                cy.findAllByTestId('postContent').eq(0).parent().then((root) => {
                    const rootId = root.attr('id').slice(8);

                    // # Click root's post dot menu.
                    cy.clickPostDotMenu(rootId, 'RHS_ROOT');

                    // # Click delete button.
                    const id = `#delete_post_${rootId}`;
                    cy.wrap(id).as('deleteId');
                });
            });

        // * Post extra options is visible
        cy.findByLabelText('Post extra options').should('exist');

        // # Click delete button.
        cy.get('@deleteId').then((deleteId) => {
            cy.get(deleteId).should('be.visible').click();
        });

        // * Check that confirmation dialog is open.
        cy.get('#deletePostModal').should('be.visible');

        // * Check that confirmation dialog contains correct text
        cy.get('#deletePostModal').
            should('contain', 'Are you sure you want to delete this message?');

        // * Check that confirmation dialog shows that the post has one comment on it
        cy.get('#deletePostModal').should('contain', 'This message has 1 comment on it.');

        // # Confirm deletion.
        cy.get('#deletePostModalButton').click();
    });
};
