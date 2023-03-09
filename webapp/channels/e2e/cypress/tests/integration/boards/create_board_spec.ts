// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @boards

import timeouts from '../../fixtures/timeouts';

describe('Create and delete board / card', () => {
    const timestamp = new Date().toLocaleString();
    const boardTitle = `Test Board (${timestamp})`;
    const cardTitle = `Test Card (${timestamp})`;

    beforeEach(() => {
        // # Login as new user
        cy.apiAdminLogin().apiInitSetup({loginAfter: true});
        cy.clearLocalStorage();
    });

    it('MM-T4274 Create an Empty Board', () => {
        cy.visit('/boards');

        // Tests for template selector
        cy.findByText('Use this template').should('exist').click();

        // Some options are present
        cy.contains('Meeting Agenda').should('exist');
        cy.contains('Personal Goals').should('exist');
        cy.contains('Project Tasks').should('exist');

        // Create empty board
        cy.findByText('Create an empty board').should('exist').click({force: true});
        cy.get('.BoardComponent').should('exist');

        // Change Title
        cy.findByPlaceholderText('Untitled board').should('be.visible').wait(timeouts.HALF_SEC).as('editableTitle');
        cy.get('@editableTitle').should('be.visible').
            clear().
            type('Testing').
            type('{enter}').
            should('have.value', 'Testing');
    });

    it('MM-T5397 Can create and delete a board and a card', () => {
        // Visit a page and create new empty board
        cy.visit('/boards');
        cy.uiCreateEmptyBoard();

        // Change board title
        cy.log('**Change board title**');
        cy.get('.Editable.title').
            type(boardTitle).
            type('{enter}').
            should('have.value', boardTitle);

        // Rename board view
        cy.log('**Rename board view**');
        const boardViewTitle = `Test board (${timestamp})`;
        cy.get(".ViewHeader>.viewSelector>.Editable[title='Board view']").should('exist');
        cy.get('.ViewHeader>.viewSelector>.Editable').
            clear().
            type(boardViewTitle).
            type('{esc}');
        cy.get(`.ViewHeader .Editable[title='${boardViewTitle}']`).should('exist');

        // Create card
        cy.log('**Create card**');
        cy.get('.ViewHeader').contains('New').click();
        cy.get('.CardDetail').should('exist');

        //Check title has focus when card is created
        cy.log('**Check title has focus when card is created**');
        cy.get('.CardDetail .EditableArea.title').
            should('have.focus');

        // Change card title
        cy.log('**Change card title**');
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.get('.CardDetail .EditableArea.title').
            click().
            should('have.focus').
            type(cardTitle).
            should('have.value', cardTitle);

        // Close card dialog
        cy.log('**Close card dialog**');
        cy.get('.Dialog Button[title=\'Close dialog\']').
            should('be.visible').
            click();

        // Create a card by clicking on the + button
        cy.log('**Create a card by clicking on the + button**');
        cy.get('.KanbanColumnHeader button .AddIcon').click();
        cy.get('.CardDetail').should('exist');
        cy.get('.Dialog.dialog-back .wrapper').click({force: true});

        // Create table view
        cy.log('**Create table view**');
        cy.get('.ViewHeader').get('.DropdownIcon').first().parent().click();
        cy.get('.ViewHeader').contains('Add view').trigger('mouseover');
        cy.get('.ViewHeader').
            contains('Add view').
            parent().
            contains('Table').
            click();
        cy.get(".ViewHeader .Editable[title='Table view']").should('exist');
        cy.get(`.TableRow [value='${cardTitle}']`).should('exist');

        // Rename table view
        cy.log('**Rename table view**');
        const tableViewTitle = `Test table (${timestamp})`;
        cy.get(".ViewHeader .Editable[title='Table view']").
            clear().
            type(tableViewTitle).
            type('{esc}');
        cy.get(`.ViewHeader .Editable[title='${tableViewTitle}']`).should('exist');

        // Sort the table
        cy.log('**Sort the table**');
        cy.get('.ViewHeader').contains('Sort').click();
        cy.get('.ViewHeader').
            contains('Sort').
            parent().
            contains('Name').
            click();

        // Delete board
        cy.log('**Delete board**');
        cy.get('.Sidebar .octo-sidebar-list').then((el) => {
            cy.log(el.text());
        });
        cy.get('.Sidebar .octo-sidebar-list').
            contains(boardTitle).
            parent().
            find('.MenuWrapper').
            find('button.IconButton').
            click({force: true});
        cy.contains('Delete board').click({force: true});
        cy.get('.DeleteBoardDialog button.danger').click({force: true});
        cy.contains(boardTitle).should('not.exist');
    });

    it('MM-T4433 Scrolls the kanban board when dragging card to edge', () => {
        // Visit a page and create new empty board
        cy.visit('/boards');
        cy.uiCreateEmptyBoard();

        // Create 10 empty groups
        cy.log('**Create new empty groups**');
        for (let i = 0; i < 10; i++) {
            cy.contains('+ Add a group').scrollIntoView().should('be.visible').click();
            cy.get('.KanbanColumnHeader .Editable[value=\'New group\']').should('have.length', i + 1);
        }

        // Create empty card in last group
        cy.log('**Create new empty card in first group**');
        cy.get('.octo-board-column').last().contains('+ New').scrollIntoView().click();
        cy.get('.Dialog').should('exist');
        cy.get('.Dialog Button[title=\'Close dialog\']').should('be.visible').click();
        cy.get('.KanbanCard').scrollIntoView().should('exist');

        // Drag card to right corner and expect scroll to occur
        cy.get('.Kanban').invoke('scrollLeft').should('not.equal', 0);

        cy.get('.KanbanCard').
            trigger('dragstart');

        // wait necessary to trigger scroll animation for some time
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.get('.Kanban').
            trigger('dragover', {clientX: 400, clientY: Cypress.config().viewportHeight / 2}).
            wait(timeouts.TEN_SEC).
            trigger('dragend');

        cy.get('.Kanban').invoke('scrollLeft').should('equal', 0);
    });

    it('MM-T5398 cut/undo/redo work in comments', () => {
        const isMAC = navigator.userAgent.indexOf('Mac') !== -1;
        const ctrlKey = isMAC ? 'meta' : 'ctrl';

        // Visit a page and create new empty board
        cy.visit('/boards');
        cy.uiCreateEmptyBoard();

        // Create card
        cy.log('**Create card**');
        cy.get('.ViewHeader').contains('New').click();
        cy.get('.CardDetail').should('exist');

        cy.log('**Add comment**');
        cy.get('.CommentsList').
            should('exist').
            findAllByTestId('preview-element').
            click();

        cy.get('.CommentsList .MarkdownEditor').
            type('Test Text');

        cy.log('**Cut comment**');
        cy.get('.CommentsList .MarkdownEditor').
            type('{selectAll}').
            trigger('cut').
            should('have.text', '');

        cy.log('**Undo comment**');
        cy.get('.CommentsList .MarkdownEditor').
            type(`{${ctrlKey}+z}`).
            should('have.text', 'Test Text');

        cy.log('**Redo comment**');
        cy.get('.CommentsList .MarkdownEditor').
            type(`{shift+${ctrlKey}+z}`).
            should('have.text', '');
    });
});
