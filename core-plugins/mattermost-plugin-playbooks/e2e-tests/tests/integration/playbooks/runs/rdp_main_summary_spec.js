// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > summary', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testRun;
    let testViewerUser;
    let testPublicPlaybook;

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

    const commonTests = () => {
        it('is visible', () => {
            // * Verify the summary section is present
            cy.findByTestId('run-summary-section').should('be.visible');
        });

        it('has title', () => {
            // * Verify the summary section is present
            cy.findByTestId('run-summary-section').find('h3').contains('Summary');
        });
    };

    describe('as participant', () => {
        commonTests();

        it('has a placeholder', () => {
            // * Assert the placeholder content
            cy.findByTestId('run-summary-section').findByTestId('rendered-text').contains('Add a run summary');
        });

        it('can be edited', () => {
            // # Mouseover the summary
            cy.findByTestId('run-summary-section').trigger('mouseover');

            cy.findByTestId('run-summary-section').within(() => {
            // # Click the edit icon
                cy.findByTestId('hover-menu-edit-button').click();

                // # Write a summary
                cy.findByTestId('editabletext-markdown-textbox2').clear().type('This is my new summary');

                // # Save changes
                cy.findByTestId('checklist-item-save-button').click();

                // * Assert that data has changed
                cy.findByTestId('rendered-text').contains('This is my new summary');
            });

            // * Assert last edition date is visible
            cy.findByTestId('run-summary-section').contains('Last edited');
        });

        it('can be canceled', () => {
            // # Mouseover the summary
            cy.findByTestId('run-summary-section').trigger('mouseover');

            cy.findByTestId('run-summary-section').within(() => {
            // # Click the edit icon
                cy.findByTestId('hover-menu-edit-button').click();

                // # Write a summary
                cy.findByTestId('editabletext-markdown-textbox2').clear().type('This is my new summary');

                // # Cancel changes
                cy.findByText('Cancel').click();

                // * Assert that data has not changed
                cy.findByTestId('rendered-text').contains('Add a run summary');
            });

            // * Assert last edition date is not visible
            cy.findByTestId('run-summary-section').should('not.contain', 'Last edited');
        });

        it('can not be edited once run is finished', () => {
            // # Finish the run
            cy.apiFinishRun(testRun.id);

            // # Mouseover the summary
            cy.findByTestId('run-summary-section').trigger('mouseover');

            // * Verify that the edit button is not rendered
            cy.findByTestId('run-summary-section').findByTestId('hover-menu-edit-button').should('not.exist');
        });
    });

    describe('as viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
        });

        commonTests();

        it('has a placeholder', () => {
            // * Assert the placeholder content
            cy.findByTestId('run-summary-section').findByTestId('rendered-text').contains('There\'s no summary');
        });

        it('can not be edited', () => {
            // # Mouseover the summary
            cy.findByTestId('run-summary-section').trigger('mouseover');

            // * Verify that the edit button is not rendered
            cy.findByTestId('run-summary-section').findByTestId('hover-menu-edit-button').should('not.exist');
        });
    });
});
