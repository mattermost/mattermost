// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FIVE_SEC} from '../../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > template', {testIsolation: true}, () => {
    let team1;
    let testUser;

    beforeEach(() => {
        cy.apiAdminLogin().then(() => {
            cy.apiInitSetup().then(({team, user}) => {
                team1 = team;
                testUser = user;

                // # Size the viewport to show the RHS without covering posts.
                cy.viewport('macbook-13');

                // # Login as testUser
                cy.apiLogin(testUser);
            });
        });
    });

    describe('create playbook', () => {
        describe('open new playbook creation modal and navigates to playbooks', () => {
            // TODO: This workflow has been deprecated with the new Checklists UI. May be re-enabled when template access is redesigned.
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('after clicking on Use', () => {
                // # Switch to playbooks DM channel
                cy.visit(`/${team1.name}/messages/@playbooks`);

                cy.wait(FIVE_SEC);

                // # Open playbooks RHS.
                cy.getPlaybooksAppBarIcon().should('be.visible').click();

                // # Create a blank checklist first to get the header with dropdown
                cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                cy.wait(1000);

                // # Click the dropdown to access "Run a playbook"
                cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();
                cy.findByTestId('create-from-playbook').click();

                // # Click on Playbook Templates tab
                cy.get('#root-portal.modal-open').within(() => {
                    cy.findByText('Playbook Templates').click();

                    // # Return first template (Blank)
                    cy.contains('Blank').click();
                });

                // * Assert playbooks creation modal is shown.
                cy.get('#playbooks_create').should('exist');

                // # Click create playbook button.
                cy.get('button[data-testid=modal-confirm-button]').click();

                // * Assert expected playbook template title in outline.
                cy.findByTestId('playbook-editor-title').contains('Blank');
            });

            // TODO: This workflow has been deprecated with the new Checklists UI. May be re-enabled when template access is redesigned.
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('after clicking on title', () => {
                // # Switch to playbooks DM channel
                cy.visit(`/${team1.name}/messages/@playbooks`);

                cy.wait(FIVE_SEC);

                // # Open playbooks RHS.
                cy.getPlaybooksAppBarIcon().should('be.visible').click();

                // # Create a blank checklist first to get the header with dropdown
                cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                cy.wait(1000);

                // # Click the dropdown to access "Run a playbook"
                cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();
                cy.findByTestId('create-from-playbook').click();

                // # Click on Playbook Templates tab and then on the template title
                cy.get('#root-portal.modal-open').within(() => {
                    cy.findByText('Playbook Templates').click();

                    // # Click on 'Blank' template title
                    cy.findByTestId('template-details').first().within(() => {
                        cy.contains('Blank').click();
                    });
                });

                // * Assert playbooks creation modal is shown.
                cy.get('#playbooks_create').should('exist');

                // # Click create playbook button.
                cy.get('button[data-testid=modal-confirm-button]').click();

                // * Assert expected playbook template title in outline.
                cy.findByTestId('playbook-editor-title').contains('Blank');
            });
        });
    });
});
