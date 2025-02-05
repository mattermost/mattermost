// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > edit', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('Edit playbook name', () => {
        it('can be updated', () => {
            // # Open Playbooks
            cy.visit('/playbooks/playbooks');

            // # Start a blank playbook
            cy.findByText('Blank').click();

            // # Open the title dropdown and Rename
            cy.findByTestId('playbook-editor-title').click();
            cy.findByText('Rename').click();

            // # Change the name and save
            cy.findByTestId('rendered-editable-text').type('{selectAll}{del}renamed playbook');
            cy.findByRole('button', {name: /save/i}).click();

            cy.reload();

            // * Verify the modified name persists
            cy.findByRole('button', {name: /renamed playbook/i}).should('exist');
        });
    });

    describe('Edit playbook description', () => {
        it('can be updated', () => {
            // # Open Playbooks
            cy.visit('/playbooks/playbooks');

            // # Start a blank playbook
            cy.findByText('Blank').click();
            cy.findByText(/customize this playbook's description/i).dblclick();
            cy.focused().type('{selectAll}{del}some new description');
            cy.findByRole('button', {name: /save/i}).click();

            cy.reload();

            cy.findByText('some new description').should('exist');
        });
    });

    describe('Duplicate', () => {
        let testPlaybook;
        beforeEach(() => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook (' + Date.now() + ')',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        it('can be duplicated', () => {
            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Open the title dropdown and Duplicate
            cy.findByTestId('playbook-editor-title').click();
            cy.findByText('Duplicate').click();

            // * Verify that playbook got duplicated
            cy.findByTestId('playbook-editor-header').within(() => {
                cy.findByText('Copy of ' + testPlaybook.title).should('exist');
            });

            // * Verify that the duplicated playbook is shown in the LHS
            cy.findByTestId('Playbooks').within(() => {
                cy.findByText('Copy of ' + testPlaybook.title).should('be.visible');
            });
        });
    });
});
