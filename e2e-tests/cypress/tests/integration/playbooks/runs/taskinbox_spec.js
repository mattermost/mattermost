// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('Task Inbox >', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    let testViewerUser;
    let testPublicPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin: adminUser}) => {
                cy.apiAddUserToTeam(testTeam.id, adminUser.id);
            });

            // Create another user in the same team
            cy.apiCreateUser().then(({user: viewer}) => {
                testViewerUser = viewer;
                cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                            {title: 'Step 3'},
                            {title: 'Step 4'},
                        ],
                    },
                ],
                memberIDs: [],
            }).then((playbook) => {
                testPublicPlaybook = playbook;

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPublicPlaybook.id,
                    playbookRunName: 'the run name',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    testRun = playbookRun;
                    cy.apiChangeChecklistItemAssignee(testRun.id, 0, 0, testUser.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        cy.visit(`/playbooks/runs/${testRun.id}`);
        cy.assertRunDetailsPageRenderComplete(testUser.username);
    });

    const getRHS = () => cy.get('#playbooks-backstage-sidebar-right');

    it('icon in global header', () => {
        // # Visit the playbooks product
        cy.visit('/playbooks');

        // # Verify icon present in global header icon to open
        cy.findByTestId('header-task-inbox-icon').click();
    });

    it('icon toggles taskinbox view', () => {
        // # Intercept all calls to telemetry
        cy.interceptTelemetry();

        // # Click on global header icon to open
        cy.findByTestId('header-task-inbox-icon').click();

        // * assert RHS is shown
        getRHS().should('be.visible');

        // * assert telemetry pageview
        cy.expectTelemetryToContain([
            {
                name: 'task_inbox',
                type: 'page',
            },
        ]);

        // * assert zero case
        getRHS().within(() => {
            cy.getStyledComponent('HeaderTitle').contains('Your tasks');
            cy.getStyledComponent('Body').contains('1 assigned');
        });

        // # Click on global header icon to close
        cy.findByTestId('header-task-inbox-icon').click();

        // * assert RHS is not shown
        getRHS().should('not.exist');
    });

    it('show unassigned tasks from runs I own', () => {
        // # Click on global header icon to open
        cy.findByTestId('header-task-inbox-icon').click();

        // * assert 4 tasks are shown (all tasks from runs I own enabled by default)
        getRHS().within(() => {
            cy.getStyledComponent('TaskList').within(() => {
                cy.getStyledComponent('Container').should('have.length', 4);
            });
        });
    });

    it('show only assigned tasks', () => {
        // # Click on global header icon to open
        cy.findByTestId('header-task-inbox-icon').click();

        getRHS().within(() => {
            cy.getStyledComponent('TaskList').within(() => {
                // * assert 4 tasks are shown
                cy.getStyledComponent('Container').should('have.length', 4);
            });

            // # Click on filters
            cy.findByText('Filters').click();
        });

        // # Deactivate show alltasks
        cy.findByText('Show all tasks from runs I own').click();

        cy.getStyledComponent('TaskList').within(() => {
            // * assert 1 tasks are shown
            cy.getStyledComponent('Container').should('have.length', 1);
        });
    });

    it('tasks can be checked', () => {
        // # Click on global header icon to open
        cy.findByTestId('header-task-inbox-icon').click();

        getRHS().within(() => {
            cy.getStyledComponent('TaskList').within(() => {
                // * assert 4 tasks are shown
                cy.getStyledComponent('Container').should('have.length', 4);

                // # Check the first task
                cy.getStyledComponent('Container').eq(0).within(() => {
                    cy.get('input').click();
                });

                // * assert 3 tasks are shown
                cy.getStyledComponent('Container').should('have.length', 3);
            });

            // # Click on filters
            cy.findByText('Filters').click();
        });

        // # Activate checked task visibility in filters
        cy.findByText('Show checked tasks').click();

        getRHS().within(() => {
            cy.getStyledComponent('TaskList').within(() => {
                // * assert 4 tasks are shown
                cy.getStyledComponent('Container').should('have.length', 4);
            });
        });
    });
});
