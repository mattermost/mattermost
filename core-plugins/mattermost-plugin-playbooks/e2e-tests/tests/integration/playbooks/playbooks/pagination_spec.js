// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > list pagination', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    const ExtraPlaybooks = 20;

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
            });

            // # Populate the DB with more elements to force the pagination
            for (let i = 0; i < ExtraPlaybooks; i++) {
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Elements before',
                    memberIDs: [],
                });
            }
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('reset page to 0 after search for an name with one value', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on next page
        cy.findByText('Next').click();

        // # Click on Search input
        cy.get('input[placeholder="Search for a playbook"]').type('Playbook');

        // * Verify the page display the first page
        cy.findByText('1–1 of 1 total');

        // * Verify that previous isn't exist
        cy.findByText('Previous').should('not.exist');
    });
});

