// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Group: @playbooks

import {switchToChannel} from '../../../channels/mark_as_unread/helpers';

describe('channels > slash command > owner', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testUser2;
    let testPlaybook;
    let playbookRunName;
    let playbookRunChannelName;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });

            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                    {
                        title: 'Stage 2',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                ],
                memberIDs: [testUser.id],
            }).then((playbook) => {
                testPlaybook = playbook;
                const now = Date.now();
                playbookRunName = `Playbook Run (${now})`;
                playbookRunChannelName = `playbook-run-${now}`;

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName,
                    ownerUserId: testUser.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);
    });

    describe('single run channel', () => {
        it('check', () => {
            // # Type a command
            cy.findByTestId('post_textbox').clear().type('/playbook check ');

            // * Verify suggestions number: a single run with 4 tasks + 1 title
            cy.get('.slash-command__info').should('have.length', 5);

            // # Clear input
            cy.findByTestId('post_textbox').clear();

            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook check 1 1 ');

            // * Verify the task is checked
            cy.get('[data-rbd-droppable-id="1"]').find('.checkbox').eq(1).should('be.checked');
        });

        it('check add', () => {
            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook checkadd 1 new-task ');

            // * Verify the task was added
            cy.get('[data-rbd-droppable-id="1"]').contains('new-task');
        });

        it('check remove', () => {
            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook checkremove 1 1 ');

            // * Verify the task was added
            cy.get('[data-rbd-droppable-id="1"]').contains('Step 2').should('not.exist');
        });

        it('owner', () => {
            // # Run a slash command
            cy.uiPostMessageQuickly('/playbook owner ');

            // * Verify the message.
            cy.verifyEphemeralMessage(`@${testUser.username} is the current owner for this playbook run.`);

            // # Run a slash command
            cy.uiPostMessageQuickly(`/playbook owner @${testUser2.username}`);

            // * Verify that the owner was set.
            cy.uiPostMessageQuickly('/playbook owner ');
            cy.verifyEphemeralMessage(`@${testUser2.username} is the current owner for this playbook run.`);
        });

        it('timeline', () => {
            // # Run a slash command on a run with view access
            cy.uiPostMessageQuickly('/playbook timeline ');

            // * Verify the message.
            cy.verifyEphemeralMessage(`Timeline for ${playbookRunName}`);
        });

        it('finish', () => {
            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook finish ');

            // * Verify confirm modal is visible.
            cy.get('#interactiveDialogModalLabel').should('exist');

            // # Confirm finish
            cy.get('#interactiveDialogSubmit').click();

            // * Verify that the run is finished.
            cy.get('#rhsContainer').findByTestId('badge').contains('Finished');
        });
    });

    describe('multiple runs in the channel', () => {
        let playbookRuns;
        let testPrivatePlaybook;
        let testPublicPlaybook;
        let testPublicChannel;
        let channelName;

        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create private playbook, channel mode set to link existing channel
            cy.apiCreatePlaybook({
                makePublic: false,
                createPublicPlaybookRun: false,
                teamId: testTeam.id,
                title: 'Playbook private',
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                    {
                        title: 'Stage 2',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                ],
                memberIDs: [testUser.id],
                channelMode: 'link_existing_channel',
            }).then((playbook) => {
                testPrivatePlaybook = playbook;
            });

            // # Create public playbook, channel mode set to link existing channel
            cy.apiCreatePlaybook({
                makePublic: true,
                teamId: testTeam.id,
                title: 'Playbook public',
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                    {
                        title: 'Stage 2',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                ],
                memberIDs: [testUser.id],
                channelMode: 'link_existing_channel',
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });

        beforeEach(() => {
            playbookRuns = [];
            const now = Date.now();
            channelName = 'public-channel-' + now;

            // # Create channel for runs
            cy.apiCreateChannel(
                testTeam.id,
                channelName,
                'public channel',
                'O',
            ).then(({channel: publicChannel}) => {
                testPublicChannel = publicChannel;

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPrivatePlaybook.id,
                    playbookRunName: 'run write access ' + now,
                    ownerUserId: testUser.id,
                    channelId: testPublicChannel.id,
                }).then((playbookRun) => {
                    cy.apiAddUsersToRun(playbookRun.id, [testUser2.id]);// add test user to participants list
                    playbookRuns.push(playbookRun);
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: testPublicPlaybook.id,
                        playbookRunName: 'run view access' + now,
                        ownerUserId: testUser.id,
                        channelId: testPublicChannel.id,
                    }).then((playbookRun2) => {
                        playbookRuns.push(playbookRun2);
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: testPrivatePlaybook.id,
                            playbookRunName: 'run no access' + now,
                            ownerUserId: testUser.id,
                            channelId: testPublicChannel.id,
                        }).then((playbookRun3) => {
                            playbookRuns.push(playbookRun3);

                            // # Add testUser2 to the channel
                            cy.apiAddUserToChannel(testPublicChannel.id, testUser2.id);

                            // # Login as testUser2
                            cy.apiLogin(testUser2);

                            // # Navigate directly to the playbook run channel
                            cy.visit(`/${testTeam.name}/channels/${testPublicChannel.name}`);
                            switchToChannel(testPublicChannel);
                        });
                    });
                });
            });
        });

        it('check', () => {
            // # Run a slash command with not enough parameters
            cy.uiPostMessageQuickly('/playbook check 1 1 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Command expects three arguments: the run number, the checklist number and the item number.');

            // # Run a slash command wrong run number
            cy.uiPostMessageQuickly('/playbook check 2 1 1 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Invalid run number');

            // # Run a slash command on a run with view access
            cy.uiPostMessageQuickly('/playbook check 0 1 1 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Become a participant to interact with this run');

            // # Type a command
            cy.findByTestId('post_textbox').clear().type('/playbook check ');

            // * Verify suggestions number: 2 runs * 4 tasks + 1 title
            cy.get('.slash-command__info').should('have.length', 9);

            // # Clear input
            cy.findByTestId('post_textbox').clear();

            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook check 1 1 1 ');
            cy.get('#rhsContainer').within(() => {
                // * Verify number of runs
                cy.get('[data-testid="run-list-card"]').should('have.length', 2);

                // # Open run details view
                cy.findByText(playbookRuns[0].name).click({force: true});
            });

            // * Verify the task is checked
            cy.get('[data-rbd-droppable-id="1"]').find('.checkbox').eq(1).should('be.checked');
        });

        it('check add', () => {
            // # Run a slash command with not enough parameters
            cy.uiPostMessageQuickly('/playbook checkadd 1 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Command expects two arguments: the run number and the checklist number.');

            // # Run a slash command wrong run number
            cy.uiPostMessageQuickly('/playbook checkadd 2 1 1 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Invalid run number');

            // # Run a slash command on a run with view access
            cy.uiPostMessageQuickly('/playbook checkadd 0 1 new-task ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Become a participant to interact with this run');

            // # Type a command
            cy.findByTestId('post_textbox').clear().type('/playbook checkadd ');

            // * Verify suggestions number: 2 runs * 2 checklists + 1 title
            cy.get('.slash-command__info').should('have.length', 5);

            // # Clear input
            cy.findByTestId('post_textbox').clear();

            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook checkadd 1 1 new-task ');

            cy.get('#rhsContainer').within(() => {
                // * Verify number of runs
                cy.get('[data-testid="run-list-card"]').should('have.length', 2);

                // # Open run details view
                cy.findByText(playbookRuns[0].name).click({force: true});
            });

            // * Verify the task was added
            cy.get('[data-rbd-droppable-id="1"]').contains('new-task');
        });

        it('check remove', () => {
            // # Run a slash command with not enough parameters
            cy.uiPostMessageQuickly('/playbook checkremove 1 1 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Command expects three arguments: the run number, the checklist number and the item number.');

            // # Run a slash command wrong run number
            cy.uiPostMessageQuickly('/playbook checkremove 2 0 1 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Invalid run number');

            // # Run a slash command on a run with view access
            cy.uiPostMessageQuickly('/playbook checkremove 0 1 0 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Become a participant to interact with this run');

            // # Type a command
            cy.findByTestId('post_textbox').clear().type('/playbook checkremove ');

            // * Verify suggestions number: 2 runs * 4 tasks + 1 title
            cy.get('.slash-command__info').should('have.length', 9);

            // # Clear input
            cy.findByTestId('post_textbox').clear();

            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook checkremove 1 1 1 ');

            cy.get('#rhsContainer').within(() => {
                // * Verify number of runs
                cy.get('[data-testid="run-list-card"]').should('have.length', 2);

                // # Open run details view
                cy.findByText(playbookRuns[0].name).click({force: true});
            });

            // * Verify the task was added
            cy.get('[data-rbd-droppable-id="1"]').contains('Step 2').should('not.exist');
        });

        it('owner', () => {
            // # Run a slash command with not enough parameters
            cy.uiPostMessageQuickly('/playbook owner ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('/playbook owner expects at most one argument.');

            // # Run a slash command wrong run number
            cy.uiPostMessageQuickly('/playbook owner 2 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Invalid run number');

            // # Run a slash command on a run with view access
            cy.uiPostMessageQuickly('/playbook owner 0 ');

            // * Verify the message.
            cy.verifyEphemeralMessage(`@${testUser.username} is the current owner for this playbook run.`);

            // # Type a command
            cy.findByTestId('post_textbox').clear().type('/playbook owner ');

            // * Verify suggestions number: 2 runs + 1 title
            cy.get('.slash-command__info').should('have.length', 3);

            // # Clear input
            cy.findByTestId('post_textbox').clear();

            // # Run a slash command on a run with view access
            cy.uiPostMessageQuickly(`/playbook owner 0 @${testUser2.username} `);

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Become a participant to interact with this run');

            // # Run a slash command on a run with write access
            cy.uiPostMessageQuickly(`/playbook owner 1 @${testUser2.username} `);

            // * Verify that the owner was set.
            cy.uiPostMessageQuickly('/playbook owner 1 ');
            cy.verifyEphemeralMessage(`@${testUser2.username} is the current owner for this playbook run.`);
        });

        it('finish', () => {
            // # Run a slash command with not enough parameters
            cy.uiPostMessageQuickly('/playbook finish ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Command expects one argument: the run number.');

            // # Run a slash command wrong run number
            cy.uiPostMessageQuickly('/playbook finish 2 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Invalid run number');

            // # Run a slash command on a run with view access
            cy.uiPostMessageQuickly('/playbook finish 0 ');

            // * Verify the message.
            cy.verifyEphemeralMessage(`userID ${testUser2.id} is not an admin or channel member`);

            // # Type a command
            cy.findByTestId('post_textbox').clear().type('/playbook finish ');

            // * Verify suggestions number: 2 runs + 1 title
            cy.get('.slash-command__info').should('have.length', 3);

            // # Clear input
            cy.findByTestId('post_textbox').clear();

            cy.get('#rhsContainer').within(() => {
                // * Verify number of runs
                cy.get('[data-testid="run-list-card"]').should('have.length', 2);

                // # Open run details view
                cy.findByText(playbookRuns[0].name).click({force: true});
            });

            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook finish 1 ');

            // * Verify confirm modal is visible.
            cy.get('#interactiveDialogModalLabel').should('exist');

            // # Confirm finish
            cy.get('#interactiveDialogSubmit').click();

            // * Verify that the run is finished.
            cy.get('#rhsContainer').findByTestId('badge').contains('Finished');
        });

        it('timeline', () => {
            // # Run a slash command with not enough parameters
            cy.uiPostMessageQuickly('/playbook timeline ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Command expects one argument: the run number.');

            // # Run a slash command wrong run number
            cy.uiPostMessageQuickly('/playbook timeline 2 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Invalid run number');

            // # Run a slash command on a run with view access
            cy.uiPostMessageQuickly('/playbook timeline 0 ');

            // * Verify the message.
            cy.verifyEphemeralMessage(`Timeline for ${playbookRuns[1].name}`);
        });

        it('update', () => {
            // # Run a slash command with not enough parameters
            cy.uiPostMessageQuickly('/playbook update ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Command expects one argument: the run number.');

            // # Run a slash command wrong run number
            cy.uiPostMessageQuickly('/playbook update 2 ');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Invalid run number');

            // # Type a command
            cy.findByTestId('post_textbox').clear().type('/playbook update ');

            // * Verify suggestions number: 2 runs + 1 title
            cy.get('.slash-command__info').should('have.length', 3);

            // # Clear input
            cy.findByTestId('post_textbox').clear();

            // # Run a slash command with correct parameters
            cy.uiPostMessageQuickly('/playbook update 1 ');

            // # Get dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // # Enter valid data
                cy.findByTestId('update_run_status_textbox').type('valid update');

                // # Submit the dialog.
                cy.get('button.confirm').click();
            });

            // * Verify that the Post update dialog has gone.
            cy.getStatusUpdateDialog().should('not.exist');

            // * Verify that the status update was posted.
            cy.getLastPost().within(() => {
                cy.findByText('posted an update for').should('exist');
            });
        });
    });
});

