// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';

Cypress.Commands.add('uiCreateSidebarCategory', (categoryName = `category-${getRandomId()}`) => {
    // # Click the New Category/Channel Dropdown button
    cy.uiGetLHSAddChannelButton().click();

    // # Click the Create New Category dropdown item
    cy.get('.AddChannelDropdown').should('be.visible').contains('.MenuItem', 'Create New Category').click();

    cy.findByRole('dialog', {name: 'Rename Category'}).should('be.visible').within(() => {
        // # Fill in the category name and click 'Create'
        cy.findByRole('textbox').should('be.visible').typeWithForce(categoryName).
            invoke('val').should('equal', categoryName);
        cy.findByRole('button', {name: 'Create'}).should('be.enabled').click();
    });

    // * Wait for the category to appear in the sidebar
    cy.contains('.SidebarChannelGroup', categoryName, {matchCase: false});

    return cy.wrap({displayName: categoryName});
});

Cypress.Commands.add('uiMoveChannelToCategory', (channelName, categoryName, newCategory = false, isChannelId = false) => {
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
});
