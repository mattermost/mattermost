// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('navigation', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as user-1
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
            }).then((playbook) => {
                cy.apiRunPlaybook({
                    teamId: team.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Playbook Run',
                    ownerUserId: user.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Navigate to the application
        cy.visit(`/${testTeam.name}/`);
    });

    it('switches to playbooks list view via sidebar view all button', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // * Verify that playbooks are shown
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
    });

    it('switches to playbook runs list view via sidebar view all button', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Switch to playbook runs
        cy.findByTestId('playbookRunsLHSButton').click();

        // * Verify that playbook runs are shown
        cy.findByTestId('titlePlaybookRun').should('exist').contains('Runs');
    });
});
