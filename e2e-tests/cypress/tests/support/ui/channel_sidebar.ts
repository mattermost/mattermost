// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from 'tests/types';
import {getRandomId} from '../../utils';

/**
 * Create a new category
 *
 * @param [categoryName] category's name
 *
 * @example
 *   cy.uiCreateSidebarCategory();
 */
function uiCreateSidebarCategory(categoryName: string = `category-${getRandomId()}`): ChainableT<any> {
    // # Click the New Category/Channel Dropdown button
    cy.uiGetLHSAddChannelButton().click();

    // # Click the Create new category dropdown item
    cy.get('.AddChannelDropdown').should('be.visible').contains('.MenuItem', 'Create new category').click();

    cy.findByRole('dialog', {name: 'Rename Category'}).should('be.visible').within(() => {
        // # Fill in the category name and click 'Create'
        cy.findByRole('textbox').should('be.visible').typeWithForce(categoryName).
            invoke('val').should('equal', categoryName);
        cy.findByRole('button', {name: 'Create'}).should('be.enabled').click();
    });

    // * Wait for the category to appear in the sidebar
    cy.contains('.SidebarChannelGroup', categoryName, {matchCase: false});

    return cy.wrap({displayName: categoryName});
}

Cypress.Commands.add('uiCreateSidebarCategory', uiCreateSidebarCategory);

/**
 * Move a channel to a category.
 * Open the channel menu, select Move to, and click either New Category or on the category.
 *
 * @param channelName channel's name
 * @param categoryName category's name
 * @param [newCategory=false] create a new category to move into
 * @param [isChannelId=false] whether channelName is a channel ID
 *
 * @example
 *   cy.uiMoveChannelToCategory('Town Square', 'Favorites');
 */
function uiMoveChannelToCategory(channelName: string, categoryName: string, newCategory = false, isChannelId = false): ChainableT<any> {
    // # Open the channel menu, select Move to
    cy.uiGetChannelSidebarMenu(channelName, isChannelId).within(() => {
        cy.findByText('Move to...').should('be.visible').trigger('mouseover');
    });

    // # Select the move to category
    cy.findAllByRole('menu', {name: 'Move to submenu'}).should('be.visible').within(() => {
        if (newCategory) {
            cy.findByText('New Category').should('be.visible').click({force: true});
        } else {
            cy.findByText(categoryName).should('be.visible').click({force: true});
        }
    });

    if (newCategory) {
        cy.findByRole('dialog', {name: 'Rename Category'}).should('be.visible').within(() => {
            // # Fill in the category name and click 'Create'
            cy.findByRole('textbox').should('be.visible').typeWithForce(categoryName).
                invoke('val').should('equal', categoryName);
            cy.findByRole('button', {name: 'Create'}).should('be.enabled').click();
        });
    }

    return cy.wrap({displayName: categoryName});
}

Cypress.Commands.add('uiMoveChannelToCategory', uiMoveChannelToCategory);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            uiCreateSidebarCategory: typeof uiCreateSidebarCategory;
            uiMoveChannelToCategory: typeof uiMoveChannelToCategory;
        }
    }
}
