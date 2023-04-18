// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > finish', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPlaybookRun;
    let testPublicPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user in the same team
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
            playbookRunName: 'the run name(' + Date.now() + ')',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testPlaybookRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
        });
    });

    it('is hidden as viewer', () => {
        cy.apiLogin(testViewerUser).then(() => {
            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${testPlaybookRun.id}`);
        });

        // * Assert that finish section does not exist
        cy.findByTestId('run-finish-section').should('not.exist');
    });

    it('is visible', () => {
        // * Verify the finish section is present
        cy.findByTestId('run-finish-section').should('be.visible');
    });

    it('has a placeholder visible', () => {
        // * Verify the placeholder is present
        cy.findByTestId('run-finish-section').contains('Time to wrap up?');
    });

    describe('finish run', () => {
        it('can be confirmed', () => {
            // # Click finish run button
            cy.findByTestId('run-finish-section').find('button').click();

            // * Check that status badge is in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that finish run modal is open and has the right title
            cy.get('#confirmModal').should('be.visible');
            cy.get('#confirmModal').find('h1').contains('Confirm finish run');

            // # Click on confirm
            cy.get('#confirmModal').get('#confirmModalButton').click();

            // * Assert finish section is not visible anymore
            cy.findByTestId('run-finish-section').should('not.exist');

            // * Assert status badge is finished
            cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

            // * Verify run has been removed from LHS
            cy.findByTestId('lhs-navigation').findByText(testPlaybookRun.name).should('not.exist');
        });

        it('can be canceled', () => {
            // # Click on finish run
            cy.findByTestId('run-finish-section').find('button').click();

            // * Check that status badge is in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that finish run modal is open
            cy.get('#confirmModal').should('be.visible');
            cy.get('#confirmModal').find('h1').contains('Confirm finish run');

            // # Click on cancel
            cy.get('#confirmModal').get('#cancelModalButton').click();

            // * Check that status badge is still in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that section is still visible
            cy.findByTestId('run-finish-section').should('be.visible');
        });
    });
});
