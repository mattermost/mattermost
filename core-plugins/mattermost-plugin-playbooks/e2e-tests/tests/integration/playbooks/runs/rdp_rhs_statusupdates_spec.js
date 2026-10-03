// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > status update', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;

    const getRHS = () => cy.findByRole('complementary');
    const getStatusUpdates = () => getRHS().findAllByTestId('status-update-card');

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
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
        });
    });

    describe('as participant', () => {
        it('rhs can not be open when there is no updates', () => {
            // * Assert that the link is not present
            cy.findByTestId('run-statusupdate-section').findByText('View all updates').should('not.exist');
        });

        it('link opens the RHS when there are updates', () => {
            cy.apiUpdateStatus({
                playbookRunId: testRun.id,
                message: 'message 1',
                reminder: 300,
            });
            cy.apiUpdateStatus({
                playbookRunId: testRun.id,
                message: 'message 2',
                reminder: 300,
            });

            // # Click View all updates link
            cy.findByTestId('run-statusupdate-section').findByText('View all updates').click();

            // * Assert RHS is open and have the correct title/subtitle
            getRHS().should('be.visible');
            getRHS().findByTestId('rhs-title').contains('Status updates');
            getRHS().findByTestId('rhs-subtitle').contains(testRun.name);

            // * Assert that we have both updates in reverse order
            getStatusUpdates().should('have.length', 2);
            getStatusUpdates().eq(0).contains('message 2');
            getStatusUpdates().eq(0).contains(testUser.username);
            getStatusUpdates().eq(1).contains('message 1');
            getStatusUpdates().eq(1).contains(testUser.username);
        });
    });

    describe('as viewer', () => {
        it('rhs can not be open when there is no updates', () => {
            // * Log in as viewer user
            cy.apiLogin(testViewerUser);

            // * Browse to test run
            cy.visit(`/playbooks/runs/${testRun.id}`);

            // * Assert that the link is not present
            cy.findByTestId('run-statusupdate-section').findByText('View all updates').should('not.exist');
        });

        it('link opens the RHS when there are updates', () => {
            cy.apiLogin(testUser).then(() => {
                cy.apiUpdateStatus({
                    playbookRunId: testRun.id,
                    message: 'message 1',
                    reminder: 300,
                });
                cy.apiUpdateStatus({
                    playbookRunId: testRun.id,
                    message: 'message 2',
                    reminder: 300,
                });
            });

            // * Log in as viewer user
            cy.apiLogin(testViewerUser);

            // * Browse to test run
            cy.visit(`/playbooks/runs/${testRun.id}`);

            // # Click View all updates link
            cy.findByTestId('run-statusupdate-section').findByText('View all updates').click();

            // * Assert RHS is open and have the correct title/subtitle
            getRHS().should('be.visible');
            getRHS().findByTestId('rhs-title').contains('Status updates');
            getRHS().findByTestId('rhs-subtitle').contains(testRun.name);

            // * Assert that we have both updates in reverse order
            getStatusUpdates().should('have.length', 2);
            getStatusUpdates().eq(0).contains('message 2');
            getStatusUpdates().eq(0).contains(testUser.username);
            getStatusUpdates().eq(1).contains('message 1');
            getStatusUpdates().eq(1).contains(testUser.username);
        });
    });
});
