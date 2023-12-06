// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > feedback', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as admin to create team and user below.
        cy.apiAdminLogin();

        // # Setup a team, user and playbook for each test.
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Test Playbook',
                memberIDs: [],
            }).then((playbook) => {
                testPlaybook = playbook;
            });

            // # Login as the newly created testUser
            cy.apiLogin(testUser);
        });
    });

    it('playbooks shows prompt in global header', () => {
        // # Visit the playbooks product
        cy.visit('/playbooks');

        // # Verify Give Feedback link is configured to open in a new tab.
        cy.findByText('Give feedback').invoke('attr', 'target').should('eq', '_blank');

        // # Verify Give Feedback link href
        cy.findByText('Give feedback').invoke('attr', 'href').should('match', /playbooks-feedback/);
    });

    it('playbooks shows prompt in rhs header', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        const playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

        // # Verify Give Feedback link is configured to open in a new tab.
        cy.findByText('Give feedback').invoke('attr', 'target').should('eq', '_blank');

        // # Verify Give Feedback link href
        cy.findByText('Give feedback').invoke('attr', 'href').should('match', /playbooks-feedback/);
    });
});
