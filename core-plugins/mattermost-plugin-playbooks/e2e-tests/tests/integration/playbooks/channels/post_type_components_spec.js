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

            // # Post a status update
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 60,
            });

            cy.getLastPost().then((element) => {
                // * Verify the expected message text
                cy.get(element).contains(`${testUser.username} posted an update for ${testPlaybookRun.name}`);
                cy.get(element).contains('status update');
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
                // # Go to the other channel
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Post a permalink to the status update
                cy.uiPostMessageQuickly(`${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`);

                cy.getLastPost().then((element) => {
                    // * Verify the expected message text
                    cy.get(element).contains(`${testUser.username} posted an update for ${testPlaybookRun.name}`);
                    cy.get(element).contains('status update');
                });
            });
        });

        // https://mattermost.atlassian.net/browse/MM-63645
        // eslint-disable-next-line no-only-tests/no-only-tests
        it.skip('displays when permalinked in a different channel, even if not a member of the original channel', () => {
            // # Go to the playbook run channel
            cy.visit(`/${testTeam.name}/channels/test-run`);

            // # Post a status update
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 60,
            });

            cy.getLastPostId().then((postId) => {
                // # Leave the playbook run channel
                cy.uiLeaveChannel();

                // # Go to the other channel
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Post a permalink to the status update
                cy.uiPostMessageQuickly(`${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`);

                cy.getLastPost().then((element) => {
                    // * Verify the expected message text
                    cy.get(element).contains(`${testUser.username} posted an update for ${testPlaybookRun.name}`);
                    cy.get(element).contains('status update');
                });
            });
        });
    });
});
