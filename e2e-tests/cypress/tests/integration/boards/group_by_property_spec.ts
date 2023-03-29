// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @boards

describe('Group board by different properties', () => {
    before(() => {
        // # Login as new user
        cy.apiInitSetup({loginAfter: true});
        cy.clearLocalStorage();
    });

    it('MM-T4291 Group by different property', () => {
        cy.visit('/boards');

        // Create new board
        cy.uiCreateNewBoard('Testing');

        // Add a new group
        cy.uiAddNewGroup('Group 1');

        // Add a new card to the group
        cy.log('**Add a new card to the group**');
        cy.findAllByRole('button', {name: '+ New'}).eq(1).click();
        cy.findByRole('dialog').should('exist');
        cy.findByTestId('select-non-editable').findByText('Group 1').should('exist');
        cy.get('#mainBoardBody').findByText('Untitled').should('exist');

        // Add new select property
        cy.log('**Add new select property**');
        cy.findAllByRole('button', {name: '+ Add a property'}).click();
        cy.findAllByRole('button', {name: 'Select'}).click();
        cy.findByRole('textbox', {name: 'Select'}).type('{enter}');
        cy.findByRole('dialog').findByRole('button', {name: 'Select'}).should('exist');

        // Close card dialog
        cy.log('**Close card dialog**');
        cy.findByRole('button', {name: 'Close dialog'}).should('exist').click();

        cy.findByRole('dialog').should('not.exist');

        // Group by new select property
        cy.log('**Group by new select property**');
        cy.findByRole('button', {name: /Group by:/}).click();
        cy.findByRole('button', {name: 'Status'}).get('.CheckIcon').should('exist');
        cy.findByRole('button', {name: 'Select'}).click();
        cy.findByTitle(/empty Select property/).contains('No Select');
        cy.get('#mainBoardBody').findByText('Untitled').should('exist');

        // Add another new group
        cy.log('**Add another new group**');
        cy.findByRole('button', {name: '+ Add a group'}).click();
        cy.findByRole('textbox', {name: 'New group'}).should('exist');

        // Add a new card to another group
        cy.log('**Add a new card to another group**');
        cy.findAllByRole('button', {name: '+ New'}).eq(1).click();
        cy.findByRole('dialog').should('exist');
        cy.findAllByTestId('select-non-editable').last().findByText('New group').should('exist');
    });
});
