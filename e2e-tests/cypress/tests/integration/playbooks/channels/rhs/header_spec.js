// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > header', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');
    });

    describe('shows name', () => {
        it('of active playbook run', () => {
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

            // * Verify the title is displayed
            cy.get('#rhsContainer').contains(playbookRunName);
        });

        it('of renamed playbook run', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Verify the existing title is displayed
                cy.get('#rhsContainer').contains(playbookRunName);

                // # Rename the channel
                cy.apiPatchChannel(playbookRun.channel_id, {
                    id: playbookRun.channel_id,
                    display_name: 'Updated',
                });

                // * Verify the updated title is displayed
                cy.get('#rhsContainer').contains(playbookRunName);
            });
        });
    });

    describe('edit summary', () => {
        it('by clicking on placeholder', () => {
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

            // # click on the field
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').click();

            // # type text in textarea
            cy.get('#rhsContainer').findByTestId('textarea-description').should('be.visible').type('new summary{ctrl+enter}');

            // * make sure the updated summary is here
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');

            // * reload the page
            cy.reload();

            // * make sure the updated summary is still there
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');
        });

        it('by clicking on dot menu item', () => {
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

            // # click on the field
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('buttons-row').invoke('show').within(() => {
                    cy.findAllByRole('button').eq(1).click();
                });
            });

            cy.findByTestId('dropdownmenu').within(() => {
                cy.get('span').should('have.length', 3);
                cy.findByText('Edit run summary').click();
            });

            // # type text in textarea
            cy.focused().should('be.visible').type('new summary{ctrl+enter}');

            // * make sure the updated summary is here
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');
        });
    });

    describe('edit summary of finished run', () => {
        let playbookRunChannelName;
        let finishedPlaybookRun;

        beforeEach(() => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                finishedPlaybookRun = playbookRun;
            });
        });

        it('by clicking on placeholder', () => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # Wait for the RHS to open
            cy.get('#rhsContainer').should('be.visible');

            // # Mark the run as finished
            cy.apiFinishRun(finishedPlaybookRun.id);

            // # click on the field
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').click();

            // * Verify textarea does not appear
            cy.get('#rhsContainer').findByTestId('textarea-description').should('not.exist');

            // * Verify no prompt to join appears (timeout ensures it fails right away before toast disappears)
            cy.findByText('Become a participant to interact with this run', {timeout: 500}).should('not.exist');
        });

        it('by clicking on dot menu item', () => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # Wait for the RHS to open
            cy.get('#rhsContainer').should('be.visible');

            // # Mark the run as finished
            cy.apiFinishRun(finishedPlaybookRun.id);

            // # click on the field
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('buttons-row').invoke('show').within(() => {
                    cy.findAllByRole('button').eq(1).click();
                });
            });

            // * Verify the menu items
            cy.findByTestId('dropdownmenu').within(() => {
                cy.get('span').should('have.length', 2);
                cy.findByText('Edit run summary').should('not.exist');
            });

            // * Verify no prompt to join appears (timeout ensures it fails right away before toast disappears)
            cy.findByText('Become a participant to interact with this run', {timeout: 500}).should('not.exist');
        });
    });
});
