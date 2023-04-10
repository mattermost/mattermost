// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
            it('after clicking on Use', () => {
                // # Switch to playbooks DM channel
                cy.visit(`/${team1.name}/messages/@playbooks`);

                // * Checking the bot badge as an indicator of page
                // * stability / rendering finished
                cy.findByText('BOT').should('be.visible');

                // # Open playbooks RHS.
                cy.getPlaybooksAppBarIcon().should('be.visible').click();

                // # Return first template (Blank)
                cy.contains('Blank').click();

                // * Assert playbooks creation modal is shown.
                cy.get('#playbooks_create').should('exist');

                // # Click create playbook button.
                cy.get('button[data-testid=modal-confirm-button]').click();

                // * Assert expected playbook template title in outline.
                cy.findByTestId('playbook-editor-title').contains('Blank');
            });

            it('after clicking on title', () => {
                // # Switch to playbooks DM channel
                cy.visit(`/${team1.name}/messages/@playbooks`);

                // * Checking the bot badge as an indicator of page
                // * stability / rendering finished
                cy.findByText('BOT').should('be.visible');

                // # Open playbooks RHS.
                cy.getPlaybooksAppBarIcon().should('be.visible').click();

                // # Return first template (Blank)
                cy.contains('Use').click();

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
