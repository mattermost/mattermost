// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('digest messages', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1', command: '/invalid'},
                            {title: 'Step 2', command: '/echo VALID'},
                            {title: 'Step 3', command: '/playbook check 0 0'},
                            {title: 'Step 4'},
                        ],
                    },
                ],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # intercepts telemetry
        cy.interceptTelemetry();

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('digest message >', () => {
        let testRun;
        before(() => {
            const runName = 'Playbook Run (' + Date.now() + ')';

            // # Start a run
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: runName,
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Set a timer that will expire.
                cy.apiUpdateStatus({
                    playbookRunId: run.id,
                    message: 'no message 1',
                    reminder: 1,
                });
                cy.apiChangeChecklistItemAssignee(run.id, 0, 0, testUser.id);
            });
        });

        it('has one run overdue and links to RDP', () => {
            // # Switch to playbooks DM channel
            cy.visit(`/${testTeam.name}/messages/@playbooks`);

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Run a slash command to show the to-do list.
            cy.uiPostMessageQuickly('/playbook todo');

            cy.getLastPost().within(() => {
                // # assert two blocks: inprogress+overdue
                cy.get('ul').should('have.length', 3);

                // * CLick the first link - overdue status
                cy.get('ul a').eq(0).click();
            });

            // # assert url is RDP
            cy.url().should('contain', '/playbooks/runs/' + testRun.id + '?from=digest_overduestatus');

            // # assert telemetry tracks correctly the origin
            cy.expectTelemetryToContain([
                {
                    name: 'run_details',
                    type: 'page',
                    properties: {
                        from: 'digest_overduestatus',
                    },
                },
            ]);
        });

        it('has one run in progress and links to RDP', () => {
            // # Switch to playbooks DM channel
            cy.visit(`/${testTeam.name}/messages/@playbooks`);

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Run a slash command to show the to-do list.
            cy.uiPostMessageQuickly('/playbook todo');

            cy.getLastPost().within(() => {
                // # assert two blocks: inprogress+overdue
                cy.get('ul').should('have.length', 3);

                // * CLick the second link - inprogress
                cy.get('ul a').eq(1).click();
            });

            // # assert url is RDP
            cy.url().should('contain', '/playbooks/runs/' + testRun.id + '?from=digest_runsinprogress');

            // # assert telemetry tracks correctly the origin
            cy.expectTelemetryToContain([
                {
                    name: 'run_details',
                    type: 'page',
                    properties: {
                        from: 'digest_runsinprogress',
                    },
                },
            ]);
        });

        it('has one run with one assigned task and links to RDP', () => {
            // # Switch to playbooks DM channel
            cy.visit(`/${testTeam.name}/messages/@playbooks`);

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Run a slash command to show the to-do list.
            cy.uiPostMessageQuickly('/playbook todo');

            cy.getLastPost().within(() => {
                // # assert two blocks: inprogress+overdue
                cy.get('ul').should('have.length', 3);

                // * CLick link - assigned task
                cy.get('p a').click();
            });

            // # assert url is RDP
            cy.url().should('contain', '/playbooks/runs/' + testRun.id + '?from=digest_assignedtask');

            // # assert telemetry tracks correctly the origin
            cy.expectTelemetryToContain([
                {
                    name: 'run_details',
                    type: 'page',
                    properties: {
                        from: 'digest_assignedtask',
                    },
                },
            ]);
        });
    });
});
