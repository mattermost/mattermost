// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > post type components', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testChannel;
    let testPlaybookRun;

    beforeEach(() => {
        cy.apiAdminLogin();

        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Test Run',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    testPlaybookRun = playbookRun;
                });
            });

            cy.apiCreateChannel(
                testTeam.id,
                'other-channel',
                'Other Channel',
                'O',
            ).then(({channel}) => {
                testChannel = channel;
            });
        });
    });

    describe('update post (custom_run_update)', () => {
        it('displays in run channel', () => {
            // # Go to the playbook run channel
            cy.visit(`/${testTeam.name}/channels/test-run`);

            // # intercepts telemetry
            cy.interceptTelemetry();

            // # Post a status update
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 60,
            });

            // Grab the post id
            cy.getLastPostId().then((postId) => {
                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'run_status_update',
                        type: 'page',
                        properties: {
                            post_id: postId,
                            playbook_run_id: testPlaybookRun.id,
                            channel_type: 'O',
                        },
                    },
                ]);
            });
        });

        it('displays when permalinked in a different channel', () => {
            // # Go to the playbook run channel
            cy.visit(`/${testTeam.name}/channels/test-run`);

            // # Post a status update
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 60,
            });

            // Grab the post id
            cy.getLastPostId().then((postId) => {
                // # intercepts telemetry
                cy.interceptTelemetry();

                // # Go to the other channel
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Post a permalink to the status update
                cy.uiPostMessageQuickly(`${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`);

                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'run_status_update',
                        type: 'page',
                        properties: {
                            post_id: postId,
                            playbook_run_id: testPlaybookRun.id,
                            channel_type: 'O',
                        },
                    },
                ]);

                cy.getLastPost().then((element) => {
                    // # Verify the expected message text
                    cy.get(element).contains(`${testUser.username} posted an update for ${testPlaybookRun.name}`);
                    cy.get(element).contains('status update');
                });
            });
        });

        it('displays when permalinked in a different channel, even if not a member of the original channel', () => {
            // # Go to the playbook run channel
            cy.visit(`/${testTeam.name}/channels/test-run`);

            // # Post a status update
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 60,
            });

            cy.getLastPostId().then((postId) => {
                // # intercepts telemetry
                cy.interceptTelemetry();

                // # Leave the playbook run channel
                cy.uiLeaveChannel();

                // # Go to the other channel
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Post a permalink to the status update
                cy.uiPostMessageQuickly(`${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`);

                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'run_status_update',
                        type: 'page',
                        properties: {
                            post_id: postId,
                            playbook_run_id: testPlaybookRun.id,
                            channel_type: '',
                        },
                    },
                ]);

                cy.getLastPost().then((element) => {
                    // # Verify the expected message text
                    cy.get(element).contains(`${testUser.username} posted an update for ${testPlaybookRun.name}`);
                    cy.get(element).contains('status update');
                });
            });
        });
    });
});
