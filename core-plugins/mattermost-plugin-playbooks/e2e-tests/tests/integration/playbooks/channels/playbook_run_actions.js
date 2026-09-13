// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > actions', {testIsolation: true}, () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testPublicChannel;
    const testUsers = [];

    before(() => {
        cy.apiInitSetup({userPrefix: 'u'}).then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin}) => {
                testSysadmin = sysadmin;
            });

            // # Create extra test users in this team
            cy.apiCreateUser({prefix: 'u'}).then((payload) => {
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
                testUsers.push(payload.user);
            });

            cy.apiCreateUser({prefix: 'u'}).then((payload) => {
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
                testUsers.push(payload.user);
            });

            // # Create a public channel
            cy.apiCreateChannel(
                testTeam.id,
                'public-channel',
                'Public Channel',
                'O',
            ).then(({channel}) => {
                testPublicChannel = channel;
                cy.apiAddUserToChannel(channel.id, testUser.id);
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

    describe(('when a playbook run starts'), () => {
        describe('invite members setting', () => {
            it('with no invited users and setting disabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the invite users disabled and no invited users
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    invitedUserIds: [],
                    inviteUsersEnabled: false,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Run (${now})`;
                const playbookRunChannelName = `run-${now}`;
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId,
                    playbookRunName,
                    ownerUserId: testUser.id,
                });

                // # Navigate to the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Verify that no users were invited
                cy.getFirstPostId().then((id) => {
                    cy.get(`#postMessageText_${id}`).
                        contains('You were added to the channel by @playbooks.').
                        should('not.contain', 'joined the channel');
                });
            });

            it('with invited users and setting enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and a playbook run with it
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    invitedUserIds: [testUsers[0].id, testUsers[1].id],
                    inviteUsersEnabled: true,
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that the users were invited
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`).within(() => {
                            cy.findByText('2 others').click();
                        });

                        cy.get(`#postMessageText_${id}`).contains(`@${testUsers[0].username}`);
                        cy.get(`#postMessageText_${id}`).contains(`@${testUsers[1].username}`);
                        cy.get(`#postMessageText_${id}`).contains('added to the channel by @playbooks.');
                    });
                });
            });

            it('with invited users and setting disabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and a playbook run with it
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    invitedUserIds: [testUsers[0].id, testUsers[1].id],
                    inviteUsersEnabled: false,
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that no users were invited
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`).
                            contains('You were added to the channel by @playbooks.').
                            should('not.contain', 'joined the channel');
                    });
                });
            });

            it('with non-existent users', () => {
                let userToRemove;
                let playbook;

                // # Create a playbook with a user that is later removed from the team
                cy.apiLogin(testSysadmin).then(() => {
                    cy.apiCreateUser().then((result) => {
                        userToRemove = result.user;
                        cy.apiAddUserToTeam(testTeam.id, userToRemove.id);

                        const playbookName = 'Playbook (' + Date.now() + ')';

                        // # Create a playbook with the user that will be removed from the team.
                        cy.apiCreatePlaybook({
                            teamId: testTeam.id,
                            title: playbookName,
                            createPublicPlaybookRun: true,
                            memberIDs: [testUser.id, testSysadmin.id],
                            invitedUserIds: [userToRemove.id],
                            inviteUsersEnabled: true,
                        }).then((res) => {
                            playbook = res;
                        });

                        // # Remove user from the team
                        cy.apiDeleteUserFromTeam(testTeam.id, userToRemove.id);
                    });
                }).then(() => {
                    cy.apiLogin(testUser);

                    // # Create a new playbook run with the playbook.
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that there is an error message from the bot
                    cy.getNthPostId(1).then((id) => {
                        cy.get(`#postMessageText_${id}`).
                            contains(`Failed to invite the following users: @${userToRemove.username}`);
                    });
                });
            });
        });

        describe('default owner setting', () => {
            it('defaults to the creator when no owner is specified', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default owner setting set to false
                // and no owner specified
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    defaultOwnerId: '',
                    defaultOwnerEnabled: false,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Run (${now})`;
                const playbookRunChannelName = `run-${now}`;
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId,
                    playbookRunName,
                    ownerUserId: testUser.id,
                });

                // # Navigate to the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Verify that the RHS shows the owner being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Owner').parent().within(() => {
                        cy.findByText(`@${testUser.username}`);
                    });
                });
            });

            it('defaults to the creator when no owner is specified, even if the setting is enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default owner setting set to false
                // and no owner specified
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    defaultOwnerId: '',
                    defaultOwnerEnabled: true,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Run (${now})`;
                const playbookRunChannelName = `run-${now}`;
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId,
                    playbookRunName,
                    ownerUserId: testUser.id,
                });

                // # Navigate to the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Verify that the RHS shows the owner being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Owner').parent().within(() => {
                        cy.findByText(`@${testUser.username}`);
                    });
                });
            });

            it('assigns the owner when they are part of the invited members list', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with the owner being part of the invited users
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    invitedUserIds: [testUsers[0].id],
                    inviteUsersEnabled: true,
                    defaultOwnerId: testUsers[0].id,
                    defaultOwnerEnabled: true,
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that the RHS shows the owner being the invited user
                    cy.get('#rhsContainer').within(() => {
                        cy.findByText('Owner').parent().within(() => {
                            cy.findByText(`@${testUsers[0].username}`);
                        });
                    });
                });
            });

            it('assigns the owner even if they are not invited', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with the owner being part of the invited users
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    invitedUserIds: [],
                    inviteUsersEnabled: false,
                    defaultOwnerId: testUsers[0].id,
                    defaultOwnerEnabled: true,
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that the RHS shows the owner being the invited user
                    cy.get('#rhsContainer').within(() => {
                        cy.findByText('Owner').parent().within(() => {
                            cy.findByText(`@${testUsers[0].username}`);
                        });
                    });
                });
            });

            it('assigns the owner when they and the creator are the same', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default owner setting set to false
                // and no owner specified
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    defaultOwnerId: testUser.id,
                    defaultOwnerEnabled: true,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Run (${now})`;
                const playbookRunChannelName = `run-${now}`;
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId,
                    playbookRunName,
                    ownerUserId: testUser.id,
                });

                // # Navigate to the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Verify that the RHS shows the owner being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Owner').parent().within(() => {
                        cy.findByText(`@${testUser.username}`);
                    });
                });
            });
        });

        describe('broadcast channel setting', () => {
            it('with channel configured and setting enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and a playbook run with it
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    broadcastChannelIds: [testPublicChannel.id],
                    broadcastEnabled: true,
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    });

                    // # Navigate to the playbook run channel.
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that the channel is created and that the first post exists.
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`).
                            contains('You were added to the channel by @playbooks.').
                            should('not.contain', 'joined the channel');
                    });

                    // # Navigate to the broadcast channel
                    cy.visit(`/${testTeam.name}/channels/${testPublicChannel.name}`);

                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#postMessageText_${lastPostId}`).contains(`${playbookRunName}`);
                        cy.get(`#postMessageText_${lastPostId}`).contains(`@${testUser.username} ran the ${playbookName} playbook.`);
                    });
                });
            });

            it('with channel configured and setting disabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and a playbook run with it
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    broadcastChannelIds: [testPublicChannel.id],
                    broadcastEnabled: false,
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that the channel is created and that the first post exists.
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`).
                            contains('You were added to the channel by @playbooks.').
                            should('not.contain', 'joined the channel');
                    });

                    // # Navigate to the broadcast channel
                    cy.visit(`/${testTeam.name}/channels/${testPublicChannel.name}`);

                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#postMessageText_${lastPostId}`).should('not.contain', `New Run: ~${playbookRunName}`);
                    });
                });
            });

            it('with non-existent channel', () => {
                let playbookId;

                // # Create a playbook with a channel that is later deleted
                cy.apiLogin(testSysadmin).then(() => {
                    const channelDisplayName = String('Channel to delete ' + Date.now());
                    const channelName = channelDisplayName.replace(/ /g, '-').toLowerCase();
                    cy.apiCreateChannel(testTeam.id, channelName, channelDisplayName).then(({channel}) => {
                        // # Create a playbook with the channel to be deleted as the announcement channel
                        cy.apiCreatePlaybook({
                            teamId: testTeam.id,
                            title: 'Playbook (' + Date.now() + ')',
                            createPublicPlaybookRun: true,
                            memberIDs: [testUser.id, testSysadmin.id],
                            broadcastChannelIds: [channel.id],
                            broadcastEnabled: true,
                        }).then((playbook) => {
                            playbookId = playbook.id;
                        });

                        // # Delete channel
                        cy.apiDeleteChannel(channel.id);
                    });
                }).then(() => {
                    cy.apiLogin(testUser);

                    // # Create a new playbook run with the playbook.
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that there is an error message from the bot
                    cy.getLastPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`).
                            contains('Failed to broadcast run creation to the configured channel.');
                    });
                });
            });
        });

        describe('creation webhook setting', () => {
            it('with webhook correctly configured and setting enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a correct webhook and the setting enabled
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [testUser.id],
                    webhookOnCreationURLs: ['https://httpbin.org/post'],
                    webhookOnCreationEnabled: true,
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                        description: 'Playbook run description.',
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify that the bot has not posted a message informing of the failure to send the webhook
                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#postMessageText_${lastPostId}`).
                            should('not.contain', 'Playbook run creation announcement through the outgoing webhook failed. Contact your System Admin for more information.');
                    });
                });
            });
        });
    });

    describe('when a playbook run is finished', () => {
        it('retrospective is disabled', () => {
            const playbookName = 'Playbook (' + Date.now() + ')';

            // # Create a new playbook run with that playbook
            const now = Date.now();
            const playbookRunName = `Run (${now})`;
            const playbookRunChannelName = `run-${now}`;

            // # Create a playbook with the disabled retrospective functionality
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: playbookName,
                createPublicPlaybookRun: true,
                memberIDs: [testUser.id],
                retrospectiveEnabled: false,
            }).then((playbook) => {
                // # Run playbook
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName,
                    ownerUserId: testUser.id,
                });
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiFinishRun(playbookRun.id);
            });

            // # Navigate to the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // * Verify that playbook run finished message was posted
            cy.findAllByTestId('postView').contains(`marked ${playbookName} as finished`);

            // * Verify that retrospective dialog was not posted
            cy.findAllByTestId('retrospective-reminder').should('not.exist');
        });
    });
});
