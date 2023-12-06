// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > list', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testAnotherUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            // # Create another user
            cy.apiCreateUser().then(({user: anotherUser}) => {
                testTeam = team;
                testUser = user;
                testAnotherUser = anotherUser;
                cy.apiAddUserToTeam(testTeam.id, anotherUser.id);

                // # Login as testUser
                cy.apiLogin(testUser);

                // # Create a public playbook
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Public Playbook',
                    makePublic: true,
                    memberIDs: [testUser.id, testAnotherUser.id],
                    createPublicPlaybookRun: true,
                }).then((playbook) => {
                    testPlaybook = playbook;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show all
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('has "Runs" and team name in heading', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbook runs
        cy.findByTestId('playbookRunsLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybookRun').should('exist').contains('Runs');
    });

    it('loads playbook run details page when clicking on a playbook run', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to runs
        cy.findByTestId('playbookRunsLHSButton').click();

        // # Find the playbook run and click to open details view
        cy.get('#playbookRunList').within(() => {
            cy.findByText(playbookRunName).click();
        });

        // * Verify that the header contains the playbook run name
        cy.findByTestId('run-header-section').get('h1').contains(playbookRunName);
    });

    describe('filters my runs only', () => {
        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Run a playbook with testUser as a participant
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'testUsers Run',
                ownerUserId: testUser.id,
            });

            // # Login as testAnotherUser
            cy.apiLogin(testAnotherUser);

            // # Run a playbook with testAnotherUser as a participant
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'testAnotherUsers Run',

                // ownerUserId: testUser.id,
                ownerUserId: testAnotherUser.id,
            });
        });

        it('for testUser', () => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Open the product
            cy.visit('/playbooks/runs');

            cy.get('#playbookRunList').within(() => {
                // # Make sure both runs are visible by default
                cy.findByText('testUsers Run').should('be.visible');
                cy.findByText('testAnotherUsers Run').should('be.visible');

                // # Filter to only my runs
                cy.findByTestId('my-runs-only').click();

                // # Verify runs by testAnotherUser are not visible
                cy.findByText('testAnotherUsers Run').should('not.exist');

                // # Verify runs by testUser remain visible
                cy.findByText('testUsers Run').should('be.visible');
            });
        });

        it('for testAnotherUser', () => {
            // # Login as testAnotherUser
            cy.apiLogin(testAnotherUser);

            // # Open the product
            cy.visit('/playbooks');
            cy.get('#playbookRunList').within(() => {
                // Make sure both runs are visible by default
                cy.findByText('testUsers Run').should('be.visible');
                cy.findByText('testAnotherUsers Run').should('be.visible');

                // # Filter to only my runs
                cy.findByTestId('my-runs-only').click();

                // # Verify runs by testUser are not visible
                cy.findByText('testUsers Run').should('not.exist');

                // # Verify runs by testAnotherUser remain visible
                cy.findByText('testAnotherUsers Run').should('be.visible');
            });
        });
    });

    describe('filters Finished runs correctly', () => {
        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Run a playbook with testUser as a participant
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'testUsers Run to be finished',
                ownerUserId: testUser.id,
            }).then((playbook) => {
                cy.apiFinishRun(playbook.id);
            });
        });

        it('shows finished runs', () => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Open the product
            cy.visit('/playbooks');

            cy.get('#playbookRunList').within(() => {
                // # Make sure runs are visible by default, and finished is not
                cy.findByText('testUsers Run').should('be.visible');
                cy.findByText('testAnotherUsers Run').should('be.visible');
                cy.findByText('testUsers Run to be finished').should('not.exist');

                // # Filter to finished runs as well
                cy.findByTestId('finished-runs').click();

                // # Verify runs remain visible
                cy.findByText('testUsers Run').should('be.visible');
                cy.findByText('testAnotherUsers Run').should('be.visible');

                // # Verify finished run is visible
                cy.findByText('testUsers Run to be finished').should('be.visible');
            });
        });
    });

    describe('LHS run list', () => {
        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            const runs = [
                {
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'run-sort-check 0',
                    ownerUserId: testUser.id,
                },
                {
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'run-sort-check 1',
                    ownerUserId: testUser.id,
                },
                {
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'run-sort-check 2',
                    ownerUserId: testUser.id,
                },
                {
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'run-sort-check 3',
                    ownerUserId: testUser.id,
                },
            ];

            Promise.all(runs.map((run) => {
                return new Promise((resolve) => cy.apiRunPlaybook(run).then(resolve));
            })).then(() => {
                cy.visit('/playbooks');
            });
        });

        it('lhs run list sorted by name', () => {
            cy.findByTestId('lhs-navigation').within(() => {
                cy.get('li:contains(run-sort-check)').each((item, index) => {
                    // * Verify run list order
                    cy.wrap(item).should('have.text', 'run-sort-check ' + index);
                });
            });
        });
    });
});
