// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > run dialog', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

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
                createPublicPlaybookRun: true,
            });

            // # Create a second playbook, so as to force dropdown.
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Second Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Navigate to the application
        cy.visit(`${testTeam.name}`);

        // # Trigger the playbook run creation dialog
        cy.openPlaybookRunDialogFromSlashCommand();

        // * Verify the playbook run creation dialog has opened
        cy.get('#interactiveDialogModal').should('exist').within(() => {
            cy.findByText('Start run').should('exist');
        });
    });

    it('cannot create a playbook run without filling required fields', () => {
        cy.get('#interactiveDialogModal').within(() => {
            cy.findByText('Start run').should('exist');

            // # Attempt to submit
            cy.get('#interactiveDialogSubmit').click();
        });

        // * Verify it didn't submit
        cy.get('#interactiveDialogModal').should('exist');

        // * Verify required fields
        cy.findByTestId('autoCompleteSelector').contains('Playbook');
        cy.findByTestId('autoCompleteSelector').contains('This field is required.');
        cy.findByTestId('playbookRunName').contains('This field is required.');
    });

    it('rejects invalid channel names', () => {
        cy.selectPlaybookFromDropdown('Playbook');

        const invalidPlaybookRunName = '  ';
        cy.get('#interactiveDialogModal').within(() => {
            cy.findByTestId('playbookRunNameinput').type(invalidPlaybookRunName, {force: true});
        });

        cy.get('#interactiveDialogModal').within(() => {
            cy.findByText('Start run').should('exist');

            // # Attempt to submit
            cy.get('#interactiveDialogSubmit').click();
        });

        // * Verify it didn't submit
        cy.get('#interactiveDialogModal').should('exist');

        // * Verify error message
        cy.get('#interactiveDialogModal').within(() => {
            cy.get('div.error-text').contains('unable to create playbook run');
        });
    });

    it('shows expected metadata', () => {
        cy.get('#interactiveDialogModal').within(() => {
            // * Shows current user as owner.
            cy.findByText(`${testUser.first_name} ${testUser.last_name}`).should('exist');

            // * Verify playbook dropdown prompt
            cy.findByText('Playbook').should('exist');

            // * Verify playbook run name prompt
            cy.findByText('Run name').should('exist');
        });
    });

    it('is canceled when cancel is clicked', () => {
        // # Populate the interactive dialog
        const playbookRunName = 'New Run' + Date.now();
        cy.get('#interactiveDialogModal').within(() => {
            cy.findByTestId('playbookRunNameinput').type('Playbook', {force: true});
        });

        // # Cancel the interactive dialog
        cy.get('#interactiveDialogCancel').click();

        // * Verify the modal is no longer displayed
        cy.get('#interactiveDialogModal').should('not.exist');

        // * Verify the playbook run did not get created
        cy.apiGetAllPlaybookRuns(testTeam.id).then((response) => {
            const allPlaybookRuns = response.body;
            const playbookRun = allPlaybookRuns.items.find((inc) => inc.name === playbookRunName);
            expect(playbookRun).to.be.undefined;
        });
    });
});
