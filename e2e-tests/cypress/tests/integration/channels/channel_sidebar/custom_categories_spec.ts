// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel_sidebar

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getRandomId} from '../../../utils';

import {clickCategoryMenuItem} from './helpers';

describe('Channel sidebar', () => {
    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T3161_1 should create a new category from sidebar menu', () => {
        const categoryName = createCategoryFromSidebarMenu();

        // * Check if the category exists
        cy.findByLabelText(categoryName).should('be.visible');
    });

    it('MM-T3161_2 should create a new category from category menu', () => {
        const categoryName = createCategoryFromSidebarMenu();

        // # Create new category from category menu
        clickCategoryMenuItem(categoryName, 'Create New Category');

        const newCategoryName = `category-${getRandomId()}`;
        cy.get('#editCategoryModal input').type(newCategoryName).type('{enter}');

        // * Check if the newly created category exists
        cy.findByLabelText(newCategoryName).should('be.visible');
    });

    it('MM-T3161_3 move an existing channel to a new category', () => {
        const newCategoryName = `category-${getRandomId()}`;

        // # Move to a new category
        cy.uiMoveChannelToCategory('Off-Topic', newCategoryName, true);

        // * Check if the newly created category exists
        cy.findByLabelText(newCategoryName).should('be.visible');
    });

    it('MM-T3163 Rename a category', () => {
        const categoryName = createCategoryFromSidebarMenu();

        // # Rename category from category menu
        clickCategoryMenuItem(categoryName, 'Rename Category');

        const renameCategory = `category-${getRandomId()}`;

        // # Rename category
        cy.get('#editCategoryModal input').clear().type(renameCategory).type('{enter}');

        // * Check if the previous category exist
        cy.findByLabelText(categoryName).should('not.exist');

        // * Check if the renamed category exists
        cy.findByLabelText(renameCategory).should('be.visible');
    });

    it('MM-T3165 Delete a category', () => {
        const categoryName = createCategoryFromSidebarMenu();

        // # Delete category from category menu
        clickCategoryMenuItem(categoryName, 'Delete Category');

        // # Click on delete button
        cy.get('.GenericModal__button.delete').click();

        // * Check if the deleted category exists
        cy.findByLabelText(categoryName).should('not.exist');
    });
});

function createCategoryFromSidebarMenu() {
    // # Start with a new category
    const categoryName = `category-${getRandomId()}`;

    // # Click on the sidebar menu dropdown
    cy.uiGetLHSAddChannelButton().click();

    // # Click on create category link
    cy.findByText('Create new category').should('be.visible').click();

    // # Verify that Create Category modal has shown up.
    // # Wait for a while until the modal has fully loaded, especially during first-time access.
    cy.get('#editCategoryModal').should('be.visible').wait(TIMEOUTS.HALF_SEC).within(() => {
        cy.findByText('Create New Category').should('be.visible');

        // # Enter category name and hit enter
        cy.findByPlaceholderText('Name your category').should('be.visible').type(categoryName).type('{enter}');
    });

    return categoryName;
}
