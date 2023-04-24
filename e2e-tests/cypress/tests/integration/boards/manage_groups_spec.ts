// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @boards

describe('Manage groups', () => {
    beforeEach(() => {
        // # Login as new user
        cy.apiAdminLogin().apiInitSetup({loginAfter: true});
        cy.clearLocalStorage();
    });

    it('MM-T4284 Adding a group', () => {
        // Visit a page and create new empty board
        cy.visit('/boards');
        cy.uiCreateEmptyBoard();

        cy.contains('+ Add a group').click({force: true});
        cy.get('.KanbanColumnHeader .Editable[value=\'New group\']').should('exist');

        cy.get('.KanbanColumnHeader .Editable[value=\'New group\']').
            clear().
            type('Group 1').
            blur();
        cy.get('.KanbanColumnHeader .Editable[value=\'Group 1\']').should('exist');
    });

    it('MM-T4285 Adding group color', () => {
        // Visit a page and create new empty board
        cy.visit('/boards');
        cy.uiCreateEmptyBoard();

        cy.contains('+ Add a group').click({force: true});
        cy.get('.KanbanColumnHeader .Editable[value=\'New group\']').should('exist');

        cy.get('.KanbanColumnHeader').last().within(() => {
            cy.get('.icon-dots-horizontal').click({force: true});
            cy.get('.menu-options').should('exist').first().within(() => {
                cy.contains('Hide').should('exist');
                cy.contains('Delete').should('exist');

                // Some colours
                cy.contains('Brown').should('exist');
                cy.contains('Gray').should('exist');
                cy.contains('Orange').should('exist');

                // Click on green
                cy.contains('Green').should('be.visible').click();
            });
        });

        cy.get('.KanbanColumnHeader').last().within(() => {
            cy.get('.Label.propColorGreen').should('exist');
        });
    });

    it('MM-T4287 Hiding/unhiding a group', () => {
        // Step 1: Create an empty board and add a group
        cy.visit('/boards');
        cy.uiCreateEmptyBoard();

        cy.contains('+ Add a group').click({force: true});
        cy.get('.KanbanColumnHeader .Editable[value=\'New group\']').should('exist');

        cy.get('.KanbanColumnHeader .Editable[value=\'New group\']').
            clear().
            type('Group 1').
            blur();

        cy.get('.KanbanColumnHeader .Editable[value=\'Group 1\']').should('exist');

        // Step 2: Click on the three dots next to "Group 1"
        cy.get('.KanbanColumnHeader').last().within(() => {
            cy.get('.icon-dots-horizontal').click({force: true});
            cy.get('.menu-options').should('exist').first().within(() => {
                cy.contains('Hide').should('exist');
                cy.contains('Delete').should('exist');

                // Some colours
                cy.contains('Brown').should('exist');
                cy.contains('Gray').should('exist');
                cy.contains('Orange').should('exist');
            });
        });

        // Step 3: Click on "Hide"
        cy.contains('Hide').click({force: true});
        cy.get('.octo-board-hidden-item').contains('Group 1').should('exist');
        cy.get('.KanbanColumnHeader .Editable[value=\'Group 1\']').should('not.exist');

        // Step 4: Click "Group 1", then click "Show" in the dropdown
        cy.contains('Group 1').click({force: true});
        cy.contains('Show').click({force: true});
        cy.get('.octo-board-hidden-item').should('not.exist');
        cy.get('.KanbanColumnHeader .Editable[value=\'Group 1\']').should('exist');
    });
});
