// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > restart run', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;

    // const taskIndex = 0;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

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
                memberIDs: [],
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
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: 'the run name',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${testRun.id}`);
        });
    });

    describe('restart run', () => {
        it('can be confirmed', () => {
            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${testRun.id}/finish`).as('routeFinish');
            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${testRun.id}/restore`).as('routeRestore');

            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // # Click finish run button
            cy.findByTestId('run-finish-section').find('button').click();
            cy.get('#confirmModal').get('#confirmModalButton').click();

            cy.wait('@routeFinish');
            cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

            cy.findByTestId('runDropdown').click();
            cy.get('.restartRun').find('span').contains('Restart run');

            cy.get('.restartRun').click();
            cy.get('#confirmModal').get('#confirmModalButton').click();
            cy.wait('@routeRestore');
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
            cy.findByTestId('lhs-navigation').findByText(testRun.name).should('exist');
        },
        );
    });
});
